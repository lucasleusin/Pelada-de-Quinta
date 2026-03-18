import { MatchStatus, Position, PresenceStatus, Prisma, Team, UserRole, UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  isMatchOnOrBeforeToday,
  isMatchOpenForPresence,
  pickPresenceStatusForConfirmation,
} from "@/lib/business";
import { getPrismaClient } from "@/lib/db";
import {
  confirmPresenceSchema,
  matchCreateSchema,
  matchScoreSchema,
  matchStatusSchema,
  matchUpdateSchema,
  participantsPresenceSchema,
  ratingsBatchSchema,
  statsBatchSchema,
  teamsSchema,
} from "@/lib/validators";
import { requireAdminApi } from "@/lib/admin";
import { resolveMatchEditAccess, type MatchEditUser } from "@/lib/match-edit-access";
import {
  emptyTeamSplitStats,
  getPrimaryTeam,
  normalizeTeams,
  resolveNextPrimaryTeam,
  sanitizeTeamSplitStats,
  sumTeamSplitStats,
  type TeamSplitStats,
} from "@/lib/team-utils";
import { notifyPresenceChange } from "@/lib/whatsapp-service";

const db = () => getPrismaClient();

function parseDateFilter(value: string | null) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function startOfTomorrow() {
  const tomorrow = startOfToday();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

function finishedMatchWhereClause() {
  const tomorrow = startOfTomorrow();

  return {
    status: { not: MatchStatus.ARCHIVED },
    matchDate: { lt: tomorrow },
    OR: [
      { status: MatchStatus.FINISHED },
      {
        AND: [
          { teamAScore: { not: null } },
          { teamBScore: { not: null } },
        ],
      },
    ],
  };
}

async function getLatestHistoricalMatchId() {
  const latestMatch = await db().match.findFirst({
    where: finishedMatchWhereClause(),
    select: { id: true },
    orderBy: [{ matchDate: "desc" }, { startTime: "desc" }, { id: "desc" }],
  });

  return latestMatch?.id ?? null;
}

async function getMatchEditAccess(matchId: string, currentUser: MatchEditUser | null) {
  const latestHistoricalMatchId =
    currentUser?.role === UserRole.ADMIN && currentUser.status === UserStatus.ACTIVE && !currentUser.mustChangePassword
      ? null
      : await getLatestHistoricalMatchId();

  const didPlayTargetMatch =
    currentUser?.playerId && currentUser.status === UserStatus.ACTIVE
      ? Boolean(
          await db().matchParticipant.findFirst({
            where: {
              matchId,
              playerId: currentUser.playerId,
              presenceStatus: PresenceStatus.CONFIRMED,
              teams: { isEmpty: false },
            },
            select: { id: true },
          }),
        )
      : false;

  return resolveMatchEditAccess({
    user: currentUser,
    latestHistoricalMatchId,
    targetMatchId: matchId,
    didPlayTargetMatch,
  });
}

function sumGoalsByTeam(
  participants: Array<{ playerId: string; teams: Team[]; teamAGoals: number; teamBGoals: number }>,
  overrides: Map<string, TeamSplitStats>,
) {
  let teamAGoals = 0;
  let teamBGoals = 0;

  for (const participant of participants) {
    const nextStats = overrides.get(participant.playerId) ??
      sanitizeTeamSplitStats(participant, participant.teams);

    teamAGoals += nextStats.teamAGoals;
    teamBGoals += nextStats.teamBGoals;
  }

  return { teamAGoals, teamBGoals };
}

function validateScoreAgainstTeamGoals(
  teamAGoals: number,
  teamBGoals: number,
  teamAScore: number | null,
  teamBScore: number | null,
) {
  if (teamAScore === null && teamAGoals > 0) {
    return "Informe o placar do Time A antes de registrar gols.";
  }

  if (teamBScore === null && teamBGoals > 0) {
    return "Informe o placar do Time B antes de registrar gols.";
  }

  if (teamAScore !== null && teamAGoals > teamAScore) {
    return "Os gols dos jogadores do Time A nao podem ultrapassar o placar do Time A.";
  }

  if (teamBScore !== null && teamBGoals > teamBScore) {
    return "Os gols dos jogadores do Time B nao podem ultrapassar o placar do Time B.";
  }

  return null;
}

function getPerformanceForTeam(
  team: Team | null,
  score: { teamAScore: number | null; teamBScore: number | null },
) {
  if (!team || score.teamAScore === null || score.teamBScore === null) {
    return null;
  }

  const ownScore = team === "A" ? score.teamAScore : score.teamBScore;
  const opponentScore = team === "A" ? score.teamBScore : score.teamAScore;
  const points = ownScore > opponentScore ? 3 : ownScore === opponentScore ? 1 : 0;
  const result = ownScore > opponentScore ? "WIN" : ownScore < opponentScore ? "LOSS" : "DRAW";

  return { points, result };
}

function getMatchPlayerKey(matchId: string, playerId: string) {
  return `${matchId}:${playerId}`;
}

function buildRatingsByPlayer(
  ratings: Array<{ matchId: string; ratedPlayerId: string; rating: number }>,
  validRatedPlayerKeys: Set<string>,
) {
  const ratingsByPlayer = new Map<string, { ratingsCount: number; averageRating: number }>();
  const sumsByPlayer = new Map<string, { total: number; count: number }>();

  for (const rating of ratings) {
    if (!validRatedPlayerKeys.has(getMatchPlayerKey(rating.matchId, rating.ratedPlayerId))) {
      continue;
    }

    const current = sumsByPlayer.get(rating.ratedPlayerId) ?? { total: 0, count: 0 };
    current.total += rating.rating;
    current.count += 1;
    sumsByPlayer.set(rating.ratedPlayerId, current);
  }

  for (const [playerId, summary] of sumsByPlayer.entries()) {
    ratingsByPlayer.set(playerId, {
      ratingsCount: summary.count,
      averageRating: summary.count > 0 ? Number((summary.total / summary.count).toFixed(2)) : 0,
    });
  }

  return ratingsByPlayer;
}

type PresenceTransitionMatch = {
  id: string;
  matchDate: Date;
  startTime: string;
  location: string | null;
};

async function applyPresenceStatusChange(
  match: PresenceTransitionMatch,
  playerId: string,
  presenceStatus: PresenceStatus,
) {
  const [existing, player] = await Promise.all([
    db().matchParticipant.findUnique({
      where: { matchId_playerId: { matchId: match.id, playerId } },
      select: {
        presenceStatus: true,
        confirmedAt: true,
        teams: true,
        primaryTeam: true,
        teamAGoals: true,
        teamAAssists: true,
        teamAGoalsConceded: true,
        teamBGoals: true,
        teamBAssists: true,
        teamBGoalsConceded: true,
      },
    }),
    db().player.findUnique({
      where: { id: playerId },
      select: { id: true, name: true },
    }),
  ]);

  const now = new Date();
  const confirmedAt =
    presenceStatus === PresenceStatus.CONFIRMED
      ? existing?.presenceStatus === PresenceStatus.CONFIRMED
        ? existing.confirmedAt ?? now
        : now
      : null;

  const nextTeams = presenceStatus === PresenceStatus.CONFIRMED ? existing?.teams ?? [] : [];
  const nextPrimaryTeam =
    presenceStatus === PresenceStatus.CONFIRMED
      ? getPrimaryTeam(existing?.primaryTeam ?? null, nextTeams)
      : null;
  const nextTeamStats = sanitizeTeamSplitStats(existing ?? emptyTeamSplitStats(), nextTeams);
  const totals = sumTeamSplitStats(nextTeamStats);

  const participant = await db().matchParticipant.upsert({
    where: { matchId_playerId: { matchId: match.id, playerId } },
    update: {
      presenceStatus,
      confirmedAt,
      teams: { set: nextTeams },
      primaryTeam: nextPrimaryTeam,
      ...nextTeamStats,
      ...totals,
    },
    create: {
      matchId: match.id,
      playerId,
      presenceStatus,
      confirmedAt,
      teams: nextTeams,
      primaryTeam: nextPrimaryTeam,
      ...nextTeamStats,
      ...totals,
    },
  });

  if (player && existing?.presenceStatus !== presenceStatus) {
    try {
      await notifyPresenceChange({
        previousStatus: existing?.presenceStatus ?? null,
        nextStatus: presenceStatus,
        player,
        match,
      });
    } catch (error) {
      console.error("Falha ao notificar WhatsApp.", error);
    }
  }
  return participant;
}

export async function listMatches(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = parseDateFilter(searchParams.get("from"));
  const to = parseDateFilter(searchParams.get("to"));
  const playerId = searchParams.get("playerId")?.trim() || undefined;
  const playerScope = searchParams.get("playerScope")?.trim() || undefined;

  const where: Prisma.MatchWhereInput = {
    status: { not: MatchStatus.ARCHIVED },
    matchDate:
      from || to
        ? {
            gte: from,
            lte: to,
          }
        : undefined,
  };

  if (playerId && playerScope !== "self-upcoming") {
    where.participants = {
      some: {
        playerId,
        presenceStatus: PresenceStatus.CONFIRMED,
        teams: { isEmpty: false },
      },
    };
  }

  return db().match.findMany({
    where,
    include: {
      participants: {
        include: {
          player: true,
        },
      },
    },
    orderBy: { matchDate: "desc" },
  });
}

export async function getNextMatch() {
  const today = startOfToday();

  return db().match.findFirst({
    where: {
      status: { not: MatchStatus.ARCHIVED },
      matchDate: { gte: today },
    },
    include: {
      participants: {
        include: {
          player: true,
        },
        orderBy: [{ presenceStatus: "asc" }, { player: { name: "asc" } }],
      },
    },
    orderBy: { matchDate: "asc" },
  });
}

export async function getMatchById(id: string, currentUser: MatchEditUser | null = null) {
  const match = await db().match.findFirst({
    where: {
      id,
      status: { not: MatchStatus.ARCHIVED },
    },
    include: {
      participants: {
        where: {
          presenceStatus: PresenceStatus.CONFIRMED,
          teams: { isEmpty: false },
        },
        include: { player: true },
        orderBy: { player: { name: "asc" } },
      },
      ratings: true,
    },
  });

  if (!match) {
    return null;
  }

  const editAccess = await getMatchEditAccess(id, currentUser);

  return {
    ...match,
    canEdit: editAccess.canEdit,
    editReason: editAccess.editReason,
  };
}

export async function confirmPresence(matchId: string, playerId: string) {
  const match = await db().match.findFirst({
    where: {
      id: matchId,
      status: { not: MatchStatus.ARCHIVED },
    },
    select: {
      id: true,
      matchDate: true,
      startTime: true,
      location: true,
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Partida nao encontrada." }, { status: 404 });
  }

  if (!isMatchOpenForPresence(match.matchDate)) {
    return NextResponse.json(
      { error: "Confirmacao indisponivel para partidas passadas." },
      { status: 400 },
    );
  }

  const existing = await db().matchParticipant.findUnique({
    where: { matchId_playerId: { matchId, playerId } },
  });

  if (existing?.presenceStatus === PresenceStatus.CONFIRMED) {
    return NextResponse.json(existing);
  }

  const confirmedCount = await db().matchParticipant.count({
    where: { matchId, presenceStatus: PresenceStatus.CONFIRMED },
  });

  const nextStatus = pickPresenceStatusForConfirmation(confirmedCount);
  const participant = await applyPresenceStatusChange(match, playerId, nextStatus);

  return NextResponse.json(participant);
}

export async function cancelPresence(matchId: string, playerId: string) {
  const match = await db().match.findFirst({
    where: {
      id: matchId,
      status: { not: MatchStatus.ARCHIVED },
    },
    select: {
      id: true,
      matchDate: true,
      startTime: true,
      location: true,
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Partida nao encontrada." }, { status: 404 });
  }

  if (!isMatchOpenForPresence(match.matchDate)) {
    return NextResponse.json(
      { error: "Desconfirmacao indisponivel para partidas passadas." },
      { status: 400 },
    );
  }

  const participant = await applyPresenceStatusChange(match, playerId, PresenceStatus.CANCELED);

  return NextResponse.json(participant);
}

export async function setPresenceStatus(
  matchId: string,
  playerId: string,
  presenceStatus: "CONFIRMED" | "WAITLIST" | "CANCELED",
) {
  const match = await db().match.findFirst({
    where: {
      id: matchId,
      status: { not: MatchStatus.ARCHIVED },
    },
    select: {
      id: true,
      matchDate: true,
      startTime: true,
      location: true,
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Partida nao encontrada." }, { status: 404 });
  }

  if (!isMatchOpenForPresence(match.matchDate)) {
    return NextResponse.json(
      { error: "Ajustes de presenca so sao permitidos em partidas em aberto." },
      { status: 400 },
    );
  }

  const participant = await applyPresenceStatusChange(match, playerId, presenceStatus);

  return NextResponse.json(participant);
}

export async function saveStats(matchId: string, body: unknown, adminMode = false, currentUser: MatchEditUser | null = null) {
  const parsed = statsBatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const match = await db().match.findFirst({
    where: {
      id: matchId,
      status: { not: MatchStatus.ARCHIVED },
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Partida nao encontrada." }, { status: 404 });
  }

  if (!adminMode) {
    const access = await getMatchEditAccess(matchId, currentUser);

    if (!access.canEdit) {
      return NextResponse.json({ error: "Edicao indisponivel para esta partida." }, { status: 403 });
    }
  }

  if (!adminMode && !isMatchOnOrBeforeToday(match.matchDate)) {
    return NextResponse.json(
      { error: "Estatisticas so podem ser enviadas em partidas de hoje ou anteriores." },
      { status: 400 },
    );
  }

  const existingParticipants = await db().matchParticipant.findMany({
    where: { matchId },
    select: {
      playerId: true,
      teams: true,
      teamAGoals: true,
      teamAAssists: true,
      teamAGoalsConceded: true,
      teamBGoals: true,
      teamBAssists: true,
      teamBGoalsConceded: true,
      primaryTeam: true,
    },
  });

  const existingParticipantByPlayerId = new Map(existingParticipants.map((participant) => [participant.playerId, participant]));
  const nextTeamStatsByPlayer = new Map(
    parsed.data.stats.map((entry) => [
      entry.playerId,
      sanitizeTeamSplitStats(entry, existingParticipantByPlayerId.get(entry.playerId)?.teams ?? []),
    ]),
  );
  const { teamAGoals, teamBGoals } = sumGoalsByTeam(existingParticipants, nextTeamStatsByPlayer);
  const scoreValidationError = validateScoreAgainstTeamGoals(
    teamAGoals,
    teamBGoals,
    match.teamAScore,
    match.teamBScore,
  );

  if (scoreValidationError) {
    return NextResponse.json({ error: scoreValidationError }, { status: 400 });
  }

  const now = new Date();

  await db().$transaction(
    parsed.data.stats.map((entry) => {
      const existingParticipant = existingParticipantByPlayerId.get(entry.playerId);
      const teamStats = nextTeamStatsByPlayer.get(entry.playerId) ?? emptyTeamSplitStats();
      const totals = sumTeamSplitStats(teamStats);
      const nextPrimaryTeam = getPrimaryTeam(existingParticipant?.primaryTeam ?? null, existingParticipant?.teams ?? []);

      return db().matchParticipant.upsert({
        where: { matchId_playerId: { matchId, playerId: entry.playerId } },
        update: {
          ...teamStats,
          ...totals,
          primaryTeam: nextPrimaryTeam,
          playedAsGoalkeeper: entry.playedAsGoalkeeper ?? false,
          statsUpdatedByPlayerId: parsed.data.createdByPlayerId ?? null,
          statsUpdatedAt: now,
        },
        create: {
          matchId,
          playerId: entry.playerId,
          teams: existingParticipant?.teams ?? [],
          primaryTeam: nextPrimaryTeam,
          ...teamStats,
          ...totals,
          playedAsGoalkeeper: entry.playedAsGoalkeeper ?? false,
          presenceStatus: PresenceStatus.CANCELED,
          statsUpdatedByPlayerId: parsed.data.createdByPlayerId ?? null,
          statsUpdatedAt: now,
        },
      });
    }),
  );

  return NextResponse.json({ ok: true, updated: parsed.data.stats.length });
}

export async function saveRatings(
  matchId: string,
  body: unknown,
  currentRaterPlayerId?: string | null,
  currentUser: MatchEditUser | null = null,
  adminMode = false,
) {
  const parsed = ratingsBatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const match = await db().match.findFirst({
    where: {
      id: matchId,
      status: { not: MatchStatus.ARCHIVED },
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Partida nao encontrada." }, { status: 404 });
  }

  if (!adminMode) {
    const access = await getMatchEditAccess(matchId, currentUser);

    if (!access.canEdit) {
      return NextResponse.json({ error: "Edicao indisponivel para esta partida." }, { status: 403 });
    }
  }

  if (!isMatchOnOrBeforeToday(match.matchDate)) {
    return NextResponse.json(
      { error: "Avaliacoes so podem ser enviadas em partidas de hoje ou anteriores." },
      { status: 400 },
    );
  }

  const normalizedRatings = parsed.data.ratings.map((item) => ({
    ...item,
    raterPlayerId: item.raterPlayerId ?? currentRaterPlayerId ?? "",
  }));

  const hasMissingRater = normalizedRatings.some((item) => !item.raterPlayerId);

  if (hasMissingRater) {
    return NextResponse.json({ error: "Jogador autenticado nao encontrado para registrar a avaliacao." }, { status: 400 });
  }

  const participantIds = Array.from(
    new Set(normalizedRatings.flatMap((item) => [item.raterPlayerId, item.ratedPlayerId])),
  );
  const eligibleParticipants = await db().matchParticipant.findMany({
    where: {
      matchId,
      presenceStatus: PresenceStatus.CONFIRMED,
      teams: { isEmpty: false },
      playerId: { in: participantIds },
    },
    select: { playerId: true },
  });
  const eligiblePlayerIds = new Set(eligibleParticipants.map((participant) => participant.playerId));

  const hasInvalidRatingTarget = normalizedRatings.some((item) => {
    const invalidRatedPlayer = !eligiblePlayerIds.has(item.ratedPlayerId);
    const invalidRaterPlayer = !adminMode && !eligiblePlayerIds.has(item.raterPlayerId);

    return invalidRatedPlayer || invalidRaterPlayer;
  });

  if (hasInvalidRatingTarget) {
    return NextResponse.json(
      { error: "Avaliacao permitida apenas para jogadores com time definido nesta partida." },
      { status: 400 },
    );
  }

  await db().$transaction(
    normalizedRatings.map((item) =>
      db().matchRating.upsert({
        where: {
          matchId_raterPlayerId_ratedPlayerId: {
            matchId,
            raterPlayerId: item.raterPlayerId,
            ratedPlayerId: item.ratedPlayerId,
          },
        },
        update: { rating: item.rating },
        create: {
          matchId,
          raterPlayerId: item.raterPlayerId,
          ratedPlayerId: item.ratedPlayerId,
          rating: item.rating,
        },
      }),
    ),
  );

  return NextResponse.json({ ok: true, saved: normalizedRatings.length });
}

export async function getRatingsSummary(matchId: string) {
  const participants = await db().matchParticipant.findMany({
    where: {
      matchId,
      presenceStatus: PresenceStatus.CONFIRMED,
      teams: { isEmpty: false },
    },
    select: {
      matchId: true,
      playerId: true,
    },
  });
  const validRatedPlayerKeys = new Set(
    participants.map((participant) => getMatchPlayerKey(participant.matchId, participant.playerId)),
  );
  const ratings = await db().matchRating.findMany({
    where: { matchId },
    select: {
      matchId: true,
      ratedPlayerId: true,
      rating: true,
    },
  });
  const ratingsByPlayer = buildRatingsByPlayer(ratings, validRatedPlayerKeys);
  const ratedPlayerIds = Array.from(ratingsByPlayer.keys());

  const players = await db().player.findMany({
    where: { id: { in: ratedPlayerIds } },
  });

  const playerById = new Map(players.map((player) => [player.id, player]));

  return ratedPlayerIds.map((ratedPlayerId) => ({
    ratedPlayerId,
    playerName: playerById.get(ratedPlayerId)?.name ?? "Jogador",
    averageRating: ratingsByPlayer.get(ratedPlayerId)?.averageRating ?? 0,
    ratingsCount: ratingsByPlayer.get(ratedPlayerId)?.ratingsCount ?? 0,
  }));
}

export async function createMatch(body: unknown) {
  const parsed = matchCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const normalizedLocation = parsed.data.location?.trim();

  const match = await db().match.create({
    data: {
      matchDate: new Date(parsed.data.matchDate),
      location: normalizedLocation && normalizedLocation.length > 0 ? normalizedLocation : "Arena dos Coqueiros",
      startTime: parsed.data.startTime ?? "19:00",
      teamAName: parsed.data.teamAName ?? "Time A",
      teamBName: parsed.data.teamBName ?? "Time B",
      status: MatchStatus.DRAFT,
    },
  });

  return NextResponse.json(match, { status: 201 });
}

export async function updateMatch(matchId: string, body: unknown) {
  const parsed = matchUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const match = await db().match.update({
    where: { id: matchId },
    data: {
      matchDate: parsed.data.matchDate ? new Date(parsed.data.matchDate) : undefined,
      location: parsed.data.location,
      startTime: parsed.data.startTime,
      teamAName: parsed.data.teamAName,
      teamBName: parsed.data.teamBName,
    },
  });

  return NextResponse.json(match);
}

export async function updateMatchStatus(matchId: string, body: unknown) {
  const parsed = matchStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const match = await db().match.update({
    where: { id: matchId },
    data: { status: parsed.data.status },
  });

  return NextResponse.json(match);
}

export async function updateMatchScore(matchId: string, body: unknown, adminMode = false, currentUser: MatchEditUser | null = null) {
  const parsed = matchScoreSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const match = await db().match.findFirst({
    where: {
      id: matchId,
      status: { not: MatchStatus.ARCHIVED },
    },
    select: {
      id: true,
      matchDate: true,
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Partida nao encontrada." }, { status: 404 });
  }

  if (!adminMode) {
    const access = await getMatchEditAccess(matchId, currentUser);

    if (!access.canEdit) {
      return NextResponse.json({ error: "Edicao indisponivel para esta partida." }, { status: 403 });
    }
  }

  if (!adminMode && !isMatchOnOrBeforeToday(match.matchDate)) {
    return NextResponse.json(
      { error: "Placar so pode ser informado para partidas de hoje ou anteriores." },
      { status: 400 },
    );
  }

  const participants = await db().matchParticipant.findMany({
    where: { matchId },
    select: {
      playerId: true,
      teams: true,
      teamAGoals: true,
      teamBGoals: true,
    },
  });

  const { teamAGoals, teamBGoals } = sumGoalsByTeam(participants, new Map());
  const scoreValidationError = validateScoreAgainstTeamGoals(
    teamAGoals,
    teamBGoals,
    parsed.data.teamAScore,
    parsed.data.teamBScore,
  );

  if (scoreValidationError) {
    return NextResponse.json({ error: scoreValidationError }, { status: 400 });
  }

  const updatedMatch = await db().match.update({
    where: { id: matchId },
    data: {
      teamAScore: parsed.data.teamAScore,
      teamBScore: parsed.data.teamBScore,
    },
  });

  return NextResponse.json(updatedMatch);
}

export async function updateTeams(matchId: string, body: unknown) {
  const parsed = teamsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const match = await db().match.findFirst({
    where: {
      id: matchId,
      status: { not: MatchStatus.ARCHIVED },
    },
    select: { id: true },
  });

  if (!match) {
    return NextResponse.json({ error: "Partida nao encontrada." }, { status: 404 });
  }

  const existingParticipants = await db().matchParticipant.findMany({
    where: {
      matchId,
      playerId: { in: parsed.data.assignments.map((assignment) => assignment.playerId) },
    },
    select: {
      playerId: true,
      presenceStatus: true,
      confirmedAt: true,
      teams: true,
      primaryTeam: true,
      teamAGoals: true,
      teamAAssists: true,
      teamAGoalsConceded: true,
      teamBGoals: true,
      teamBAssists: true,
      teamBGoalsConceded: true,
    },
  });
  const existingParticipantByPlayerId = new Map(existingParticipants.map((participant) => [participant.playerId, participant]));
  const now = new Date();

  const updatedParticipants = await db().$transaction(
    parsed.data.assignments.map((assignment) => {
      const existingParticipant = existingParticipantByPlayerId.get(assignment.playerId);
      const nextTeams = normalizeTeams(assignment.teams);
      const nextPrimaryTeam = resolveNextPrimaryTeam(
        nextTeams,
        assignment.primaryTeam ?? null,
        existingParticipant?.primaryTeam ?? null,
        existingParticipant?.teams ?? [],
      );
      const nextPresenceStatus =
        nextTeams.length > 0
          ? PresenceStatus.CONFIRMED
          : existingParticipant?.presenceStatus ?? PresenceStatus.CANCELED;
      const nextConfirmedAt =
        nextPresenceStatus === PresenceStatus.CONFIRMED
          ? existingParticipant?.presenceStatus === PresenceStatus.CONFIRMED
            ? existingParticipant.confirmedAt ?? now
            : now
          : null;
      const nextTeamStats = sanitizeTeamSplitStats(existingParticipant ?? emptyTeamSplitStats(), nextTeams);
      const totals = sumTeamSplitStats(nextTeamStats);

      return db().matchParticipant.upsert({
        where: {
          matchId_playerId: {
            matchId,
            playerId: assignment.playerId,
          },
        },
        update: {
          teams: { set: nextTeams },
          primaryTeam: nextPrimaryTeam,
          presenceStatus: nextPresenceStatus,
          confirmedAt: nextConfirmedAt,
          ...nextTeamStats,
          ...totals,
        },
        create: {
          matchId,
          playerId: assignment.playerId,
          teams: nextTeams,
          primaryTeam: nextPrimaryTeam,
          presenceStatus: nextPresenceStatus,
          confirmedAt: nextConfirmedAt,
          ...nextTeamStats,
          ...totals,
        },
      });
    }),
  );

  return NextResponse.json({ ok: true, updatedParticipants });
}

export async function updateParticipantPresence(matchId: string, playerId: string, body: unknown) {
  const parsed = participantsPresenceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const match = await db().match.findFirst({
    where: {
      id: matchId,
      status: { not: MatchStatus.ARCHIVED },
    },
    select: {
      id: true,
      matchDate: true,
      startTime: true,
      location: true,
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Partida nao encontrada." }, { status: 404 });
  }

  const participant = await applyPresenceStatusChange(match, playerId, parsed.data.presenceStatus);

  return NextResponse.json(participant);
}

export async function getLeaderboards() {
  const finishedMatches = await db().match.findMany({
    where: finishedMatchWhereClause(),
    select: { id: true },
  });
  const matchIds = finishedMatches.map((match) => match.id);

  if (matchIds.length === 0) {
    return {
      topScorers: [],
      topAssists: [],
      mostConceded: [],
      mvp: [],
    };
  }

  const participants = await db().matchParticipant.findMany({
    where: {
      matchId: { in: matchIds },
      presenceStatus: PresenceStatus.CONFIRMED,
      teams: { isEmpty: false },
    },
    select: {
      matchId: true,
      playerId: true,
      goals: true,
      assists: true,
      goalsConceded: true,
    },
  });
  const playerIds = Array.from(new Set(participants.map((participant) => participant.playerId)));
  const [players, ratings] = await Promise.all([
    db().player.findMany({ where: { id: { in: playerIds } } }),
    db().matchRating.findMany({
      where: { matchId: { in: matchIds } },
      select: {
        matchId: true,
        ratedPlayerId: true,
        rating: true,
      },
    }),
  ]);
  const playerById = new Map(players.map((player) => [player.id, player]));
  const validRatedPlayerKeys = new Set(
    participants.map((participant) => getMatchPlayerKey(participant.matchId, participant.playerId)),
  );
  const ratingsByPlayer = buildRatingsByPlayer(ratings, validRatedPlayerKeys);
  const statsByPlayer = new Map<
    string,
    { playerId: string; playerName: string; goals: number; assists: number; goalsConceded: number }
  >();

  for (const participant of participants) {
    const existing = statsByPlayer.get(participant.playerId) ?? {
      playerId: participant.playerId,
      playerName: playerById.get(participant.playerId)?.name ?? "Jogador",
      goals: 0,
      assists: 0,
      goalsConceded: 0,
    };
    existing.goals += participant.goals;
    existing.assists += participant.assists;
    existing.goalsConceded += participant.goalsConceded;
    statsByPlayer.set(participant.playerId, existing);
  }

  const rows = Array.from(statsByPlayer.values()).map((row) => ({
    ...row,
    averageRating: ratingsByPlayer.get(row.playerId)?.averageRating ?? 0,
    ratingsCount: ratingsByPlayer.get(row.playerId)?.ratingsCount ?? 0,
  }));

  return {
    topScorers: [...rows].sort((a, b) => b.goals - a.goals || a.playerName.localeCompare(b.playerName)),
    topAssists: [...rows].sort((a, b) => b.assists - a.assists || a.playerName.localeCompare(b.playerName)),
    mostConceded: [...rows].sort(
      (a, b) => b.goalsConceded - a.goalsConceded || a.playerName.localeCompare(b.playerName),
    ),
    mvp: [...rows].sort(
      (a, b) =>
        b.averageRating - a.averageRating ||
        b.ratingsCount - a.ratingsCount ||
        a.playerName.localeCompare(b.playerName),
    ),
  };
}

export async function getAttendanceReport() {
  const finishedMatches = await db().match.findMany({
    where: finishedMatchWhereClause(),
    select: { id: true },
  });
  const eligibleMatchIds = finishedMatches.map((match) => match.id);
  const eligibleMatches = eligibleMatchIds.length;

  const players = await db().player.findMany({
    where: {
      mergedIntoPlayerId: null,
    },
    orderBy: { name: "asc" },
  });
  const confirmedByPlayer = await db().matchParticipant.groupBy({
    by: ["playerId"],
    where: {
      presenceStatus: PresenceStatus.CONFIRMED,
      matchId: { in: eligibleMatchIds },
      teams: { isEmpty: false },
    },
    _count: { _all: true },
  });

  const confirmedMap = new Map(confirmedByPlayer.map((item) => [item.playerId, item._count._all]));

  return players.map((player) => {
    const confirmed = confirmedMap.get(player.id) ?? 0;
    const percentage = eligibleMatches > 0 ? Number(((confirmed / eligibleMatches) * 100).toFixed(1)) : 0;

    return {
      playerId: player.id,
      playerName: player.name,
      confirmed,
      eligibleMatches,
      attendancePercentage: percentage,
    };
  });
}

export async function getGeneralStatsOverview() {
  const finishedMatches = await db().match.findMany({
    where: finishedMatchWhereClause(),
    select: { id: true },
  });

  const matchIds = finishedMatches.map((match) => match.id);
  const totalMatches = finishedMatches.length;

  if (totalMatches === 0) {
    return {
      totalMatches: 0,
      totalGoals: 0,
      totalAssists: 0,
      topScorer: { name: "-", goals: 0 },
      topAssist: { name: "-", assists: 0 },
      topConcededGoalkeeper: { name: "-", goalsConceded: 0 },
      efficiency: [],
      attendance: [],
      topScorers: [],
      topAssists: [],
      mostConceded: [],
      mvp: [],
    };
  }

  const playedParticipants = await db().matchParticipant.findMany({
    where: {
      matchId: { in: matchIds },
      presenceStatus: PresenceStatus.CONFIRMED,
      teams: { isEmpty: false },
    },
    select: {
      matchId: true,
      playerId: true,
      teams: true,
      primaryTeam: true,
      goals: true,
      assists: true,
      goalsConceded: true,
      match: {
        select: {
          teamAScore: true,
          teamBScore: true,
        },
      },
    },
  });

  const players = await db().player.findMany({
    where: {
      id: {
        in: Array.from(new Set(playedParticipants.map((item) => item.playerId))),
      },
    },
    select: { id: true, name: true, position: true },
  });

  const playerById = new Map(players.map((player) => [player.id, player]));
  const ratings = await db().matchRating.findMany({
    where: { matchId: { in: matchIds } },
    select: {
      matchId: true,
      ratedPlayerId: true,
      rating: true,
    },
  });
  const validRatedPlayerKeys = new Set(
    playedParticipants.map((participant) => getMatchPlayerKey(participant.matchId, participant.playerId)),
  );
  const ratingsByPlayer = buildRatingsByPlayer(ratings, validRatedPlayerKeys);
  const statsByPlayer = new Map<
    string,
    {
      playerId: string;
      playerName: string;
      position: Position;
      goals: number;
      assists: number;
      goalsConceded: number;
      confirmed: number;
    }
  >();

  let totalGoals = 0;
  let totalAssists = 0;

  for (const participant of playedParticipants) {
    totalGoals += participant.goals;
    totalAssists += participant.assists;

    const existing = statsByPlayer.get(participant.playerId) ?? {
      playerId: participant.playerId,
      playerName: playerById.get(participant.playerId)?.name ?? "Jogador",
      position: playerById.get(participant.playerId)?.position ?? Position.OUTRO,
      goals: 0,
      assists: 0,
      goalsConceded: 0,
      confirmed: 0,
    };
    existing.goals += participant.goals;
    existing.assists += participant.assists;
    existing.goalsConceded += participant.goalsConceded;
    existing.confirmed += 1;
    statsByPlayer.set(participant.playerId, existing);
  }

  const rows = Array.from(statsByPlayer.values()).map((item) => ({
    playerId: item.playerId,
    playerName: item.playerName,
    position: item.position,
    goals: item.goals,
    assists: item.assists,
    goalsConceded: item.goalsConceded,
    confirmed: item.confirmed,
  }));

  const rankingRows = rows.map((row) => ({
    playerId: row.playerId,
    playerName: row.playerName,
    goals: row.goals,
    assists: row.assists,
    goalsConceded: row.goalsConceded,
    averageRating: ratingsByPlayer.get(row.playerId)?.averageRating ?? 0,
    ratingsCount: ratingsByPlayer.get(row.playerId)?.ratingsCount ?? 0,
  }));
  const attendance = rows
    .map((row) => {
      const attendancePercentage =
        totalMatches > 0 ? Number(((row.confirmed / totalMatches) * 100).toFixed(1)) : 0;

      return {
        playerId: row.playerId,
        playerName: row.playerName,
        confirmed: row.confirmed,
        eligibleMatches: totalMatches,
        attendancePercentage,
      };
    })
    .sort((a, b) => b.attendancePercentage - a.attendancePercentage || b.confirmed - a.confirmed || a.playerName.localeCompare(b.playerName));

  const topScorer = [...rows].sort((a, b) => b.goals - a.goals || a.playerName.localeCompare(b.playerName))[0];
  const topAssist = [...rows].sort((a, b) => b.assists - a.assists || a.playerName.localeCompare(b.playerName))[0];
  const goalkeepers = rows.filter((row) => row.position === Position.GOLEIRO);
  const concededPool = goalkeepers.length > 0 ? goalkeepers : rows;
  const topConcededGoalkeeper = [...concededPool].sort(
    (a, b) => b.goalsConceded - a.goalsConceded || a.playerName.localeCompare(b.playerName),
  )[0];

  const performanceMap = new Map<
    string,
    { playerId: string; playerName: string; points: number; matchesWithResult: number; efficiency: number }
  >();

  for (const participant of playedParticipants) {
    const performance = getPerformanceForTeam(
      getPrimaryTeam(participant.primaryTeam, participant.teams),
      participant.match,
    );
    if (!performance) continue;

    const existing = performanceMap.get(participant.playerId) ?? {
      playerId: participant.playerId,
      playerName: playerById.get(participant.playerId)?.name ?? "Jogador",
      points: 0,
      matchesWithResult: 0,
      efficiency: 0,
    };

    existing.points += performance.points;
    existing.matchesWithResult += 1;
    performanceMap.set(participant.playerId, existing);
  }

  const efficiency = Array.from(performanceMap.values())
    .map((item) => ({
      ...item,
      efficiency:
        item.matchesWithResult > 0
          ? Number(((item.points / (item.matchesWithResult * 3)) * 100).toFixed(1))
          : 0,
    }))
    .sort(
      (a, b) =>
        b.efficiency - a.efficiency ||
        b.points - a.points ||
        b.matchesWithResult - a.matchesWithResult ||
        a.playerName.localeCompare(b.playerName),
    );

  return {
    totalMatches,
    totalGoals,
    totalAssists,
    topScorer: {
      name: topScorer?.playerName ?? "-",
      goals: topScorer?.goals ?? 0,
    },
    topAssist: {
      name: topAssist?.playerName ?? "-",
      assists: topAssist?.assists ?? 0,
    },
    topConcededGoalkeeper: {
      name: topConcededGoalkeeper?.playerName ?? "-",
      goalsConceded: topConcededGoalkeeper?.goalsConceded ?? 0,
    },
    efficiency,
    attendance,
    topScorers: [...rankingRows].sort((a, b) => b.goals - a.goals || a.playerName.localeCompare(b.playerName)),
    topAssists: [...rankingRows].sort((a, b) => b.assists - a.assists || a.playerName.localeCompare(b.playerName)),
    mostConceded: [...rankingRows].sort(
      (a, b) => b.goalsConceded - a.goalsConceded || a.playerName.localeCompare(b.playerName),
    ),
    mvp: [...rankingRows].sort(
      (a, b) => b.averageRating - a.averageRating || b.ratingsCount - a.ratingsCount || a.playerName.localeCompare(b.playerName),
    ),
  };
}

export async function getPlayerReport(playerId: string) {
  const finishedMatchWhere = finishedMatchWhereClause();
  const player = await db().player.findUnique({ where: { id: playerId } });

  if (!player) {
    return null;
  }

  const history = await db().matchParticipant.findMany({
    where: {
      playerId,
      presenceStatus: PresenceStatus.CONFIRMED,
      teams: { isEmpty: false },
      match: finishedMatchWhere,
    },
    include: {
      match: true,
    },
    orderBy: {
      match: {
        matchDate: "desc",
      },
    },
  });

  const historyMatchIds = history.map((item) => item.matchId);
  const [ratings, ratingsByMatch] =
    historyMatchIds.length > 0
      ? await Promise.all([
          db().matchRating.aggregate({
            where: {
              ratedPlayerId: playerId,
              matchId: { in: historyMatchIds },
            },
            _avg: { rating: true },
            _count: { _all: true },
          }),
          db().matchRating.findMany({
            select: {
              matchId: true,
              rating: true,
            },
            where: {
              ratedPlayerId: playerId,
              matchId: { in: historyMatchIds },
            },
          }),
        ])
      : [
          {
            _avg: { rating: null },
            _count: { _all: 0 },
          },
          [],
        ];
  const ratingSummaryByMatchId = new Map(
    Array.from(
      ratingsByMatch.reduce(
        (summary, rating) => {
          const current = summary.get(rating.matchId) ?? { total: 0, count: 0 };
          current.total += rating.rating;
          current.count += 1;
          summary.set(rating.matchId, current);
          return summary;
        },
        new Map<string, { total: number; count: number }>(),
      ),
    ).map(([matchId, summary]) => [
      matchId,
      {
        averageRating: Number((summary.total / summary.count).toFixed(2)),
        ratingsCount: summary.count,
      },
    ]),
  );

  let wins = 0;
  let losses = 0;
  let draws = 0;
  let resultMatches = 0;
  let goals = 0;
  let assists = 0;
  let goalsConceded = 0;

  for (const item of history) {
    goals += item.goals;
    assists += item.assists;
    goalsConceded += item.goalsConceded;

    const performance = getPerformanceForTeam(getPrimaryTeam(item.primaryTeam, item.teams), item.match);
    if (!performance) continue;

    resultMatches += 1;
    if (performance.result === "WIN") wins += 1;
    else if (performance.result === "LOSS") losses += 1;
    else draws += 1;
  }

  const matches = history.length;
  const avgRating = Number(ratings._avg.rating?.toFixed(2) ?? 0);
  const ratingsCount = ratings._count._all;
  const goalsPerMatch = matches > 0 ? Number((goals / matches).toFixed(2)) : 0;
  const avgGoalsPerMatch = matches > 0 ? Number((goals / matches).toFixed(2)) : 0;
  const avgAssistsPerMatch = matches > 0 ? Number((assists / matches).toFixed(2)) : 0;
  const avgConcededPerMatch = matches > 0 ? Number((goalsConceded / matches).toFixed(2)) : 0;
  const efficiency =
    resultMatches > 0 ? Number((((wins * 3 + draws) / (resultMatches * 3)) * 100).toFixed(1)) : 0;
  const historyWithSummary = history.map((item) => {
    const performance = getPerformanceForTeam(getPrimaryTeam(item.primaryTeam, item.teams), item.match);
    const ratingSummary = ratingSummaryByMatchId.get(item.matchId);

    return {
      ...item,
      result: performance?.result ?? null,
      averageRating: ratingSummary?.averageRating ?? null,
      ratingsCount: ratingSummary?.ratingsCount ?? 0,
    };
  });

  return {
    player,
    totals: {
      matches,
      goals,
      assists,
      goalsConceded,
      avgRating,
      ratingsCount,
      wins,
      losses,
      draws,
      goalsPerMatch,
      avgGoalsPerMatch,
      avgAssistsPerMatch,
      avgConcededPerMatch,
      efficiency,
    },
    history: historyWithSummary,
  };
}

export async function exportLeaderboardCsv() {
  const report = await getLeaderboards();
  const rows = report.topScorers;
  const headers = ["Jogador", "Gols", "Assistencias", "Gols Sofridos", "Media Avaliacao", "Qtd Avaliacoes"];

  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.playerName,
        row.goals,
        row.assists,
        row.goalsConceded,
        row.averageRating.toFixed(2),
        row.ratingsCount,
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    ),
  ];

  return csvRows.join("\n");
}

export async function requireAdminOr401() {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) {
    return { ok: false as const, response: adminCheck.response };
  }

  return { ok: true as const };
}

export async function parseConfirmBody(body: unknown) {
  return confirmPresenceSchema.safeParse(body);
}



