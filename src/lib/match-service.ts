import { MatchStatus, Position, PresenceStatus, Prisma, Team } from "@prisma/client";
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
import {
  emptyTeamSplitStats,
  normalizeTeams,
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

function finishedMatchWhereClause(today: Date) {
  const tomorrow = startOfTomorrow();

  return {
    status: { not: MatchStatus.ARCHIVED },
    OR: [
      { matchDate: { lt: today } },
      {
        AND: [
          { matchDate: { gte: today } },
          { matchDate: { lt: tomorrow } },
          { teamAScore: { not: null } },
          { teamBScore: { not: null } },
        ],
      },
    ],
  };
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
  const nextTeamStats = sanitizeTeamSplitStats(existing ?? emptyTeamSplitStats(), nextTeams);
  const totals = sumTeamSplitStats(nextTeamStats);

  const participant = await db().matchParticipant.upsert({
    where: { matchId_playerId: { matchId: match.id, playerId } },
    update: {
      presenceStatus,
      confirmedAt,
      teams: { set: nextTeams },
      ...nextTeamStats,
      ...totals,
    },
    create: {
      matchId: match.id,
      playerId,
      presenceStatus,
      confirmedAt,
      teams: nextTeams,
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

  if (playerId) {
    where.participants = {
      some: {
        playerId,
        presenceStatus: PresenceStatus.CONFIRMED,
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

export async function getMatchById(id: string) {
  return db().match.findFirst({
    where: {
      id,
      status: { not: MatchStatus.ARCHIVED },
    },
    include: {
      participants: {
        where: { presenceStatus: PresenceStatus.CONFIRMED },
        include: { player: true },
        orderBy: { player: { name: "asc" } },
      },
      ratings: true,
    },
  });
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

export async function saveStats(matchId: string, body: unknown, adminMode = false) {
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

      return db().matchParticipant.upsert({
        where: { matchId_playerId: { matchId, playerId: entry.playerId } },
        update: {
          ...teamStats,
          ...totals,
          playedAsGoalkeeper: entry.playedAsGoalkeeper ?? false,
          statsUpdatedByPlayerId: parsed.data.createdByPlayerId ?? null,
          statsUpdatedAt: now,
        },
        create: {
          matchId,
          playerId: entry.playerId,
          teams: existingParticipant?.teams ?? [],
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

export async function saveRatings(matchId: string, body: unknown) {
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

  if (!isMatchOnOrBeforeToday(match.matchDate)) {
    return NextResponse.json(
      { error: "Avaliacoes so podem ser enviadas em partidas de hoje ou anteriores." },
      { status: 400 },
    );
  }

  await db().$transaction(
    parsed.data.ratings.map((item) =>
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

  return NextResponse.json({ ok: true, saved: parsed.data.ratings.length });
}

export async function getRatingsSummary(matchId: string) {
  const grouped = await db().matchRating.groupBy({
    by: ["ratedPlayerId"],
    where: { matchId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const players = await db().player.findMany({
    where: { id: { in: grouped.map((item) => item.ratedPlayerId) } },
  });

  const playerById = new Map(players.map((player) => [player.id, player]));

  return grouped.map((item) => ({
    ratedPlayerId: item.ratedPlayerId,
    playerName: playerById.get(item.ratedPlayerId)?.name ?? "Jogador",
    averageRating: Number(item._avg.rating?.toFixed(2) ?? 0),
    ratingsCount: item._count.rating,
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

export async function updateMatchScore(matchId: string, body: unknown, adminMode = false) {
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
          presenceStatus: nextPresenceStatus,
          confirmedAt: nextConfirmedAt,
          ...nextTeamStats,
          ...totals,
        },
        create: {
          matchId,
          playerId: assignment.playerId,
          teams: nextTeams,
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
  const today = startOfToday();
  const finishedMatches = await db().match.findMany({
    where: finishedMatchWhereClause(today),
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

  const groups = await db().matchParticipant.groupBy({
    by: ["playerId"],
    where: { matchId: { in: matchIds } },
    _sum: {
      goals: true,
      assists: true,
      goalsConceded: true,
    },
  });

  const ratingGroups = await db().matchRating.groupBy({
    by: ["ratedPlayerId"],
    where: { matchId: { in: matchIds } },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const players = await db().player.findMany({ where: { id: { in: groups.map((g) => g.playerId) } } });
  const playerById = new Map(players.map((player) => [player.id, player]));
  const ratingsByPlayer = new Map(ratingGroups.map((item) => [item.ratedPlayerId, item]));

  const rows = groups.map((group) => {
    const rating = ratingsByPlayer.get(group.playerId);

    return {
      playerId: group.playerId,
      playerName: playerById.get(group.playerId)?.name ?? "Jogador",
      goals: group._sum.goals ?? 0,
      assists: group._sum.assists ?? 0,
      goalsConceded: group._sum.goalsConceded ?? 0,
      averageRating: Number(rating?._avg.rating?.toFixed(2) ?? 0),
      ratingsCount: rating?._count.rating ?? 0,
    };
  });

  return {
    topScorers: [...rows].sort((a, b) => b.goals - a.goals),
    topAssists: [...rows].sort((a, b) => b.assists - a.assists),
    mostConceded: [...rows].sort((a, b) => b.goalsConceded - a.goalsConceded),
    mvp: [...rows].sort((a, b) => b.averageRating - a.averageRating),
  };
}

export async function getAttendanceReport() {
  const today = startOfToday();
  const finishedMatches = await db().match.findMany({
    where: finishedMatchWhereClause(today),
    select: { id: true },
  });
  const eligibleMatchIds = finishedMatches.map((match) => match.id);
  const eligibleMatches = eligibleMatchIds.length;

  const players = await db().player.findMany({ orderBy: { name: "asc" } });
  const confirmedByPlayer = await db().matchParticipant.groupBy({
    by: ["playerId"],
    where: {
      presenceStatus: PresenceStatus.CONFIRMED,
      matchId: { in: eligibleMatchIds },
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
  const today = startOfToday();

  const finishedMatches = await db().match.findMany({
    where: finishedMatchWhereClause(today),
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

  const totals = await db().matchParticipant.aggregate({
    where: {
      matchId: { in: matchIds },
      presenceStatus: PresenceStatus.CONFIRMED,
    },
    _sum: { goals: true, assists: true },
  });

  const grouped = await db().matchParticipant.groupBy({
    by: ["playerId"],
    where: {
      matchId: { in: matchIds },
      presenceStatus: PresenceStatus.CONFIRMED,
    },
    _sum: {
      goals: true,
      assists: true,
      goalsConceded: true,
    },
  });

  const resultParticipants = await db().matchParticipant.findMany({
    where: {
      matchId: { in: matchIds },
      presenceStatus: PresenceStatus.CONFIRMED,
      teams: { isEmpty: false },
    },
    select: {
      playerId: true,
      teams: true,
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
        in: Array.from(
          new Set([...grouped.map((item) => item.playerId), ...resultParticipants.map((item) => item.playerId)]),
        ),
      },
    },
    select: { id: true, name: true, position: true },
  });

  const playerById = new Map(players.map((player) => [player.id, player]));

  const rows = grouped.map((item) => ({
    playerId: item.playerId,
    playerName: playerById.get(item.playerId)?.name ?? "Jogador",
    position: playerById.get(item.playerId)?.position ?? Position.OUTRO,
    goals: item._sum.goals ?? 0,
    assists: item._sum.assists ?? 0,
    goalsConceded: item._sum.goalsConceded ?? 0,
  }));

  const ratingGroups = await db().matchRating.groupBy({
    by: ["ratedPlayerId"],
    where: { matchId: { in: matchIds } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const ratingsByPlayer = new Map(ratingGroups.map((item) => [item.ratedPlayerId, item]));

  const rankingRows = rows.map((row) => ({
    playerId: row.playerId,
    playerName: row.playerName,
    goals: row.goals,
    assists: row.assists,
    goalsConceded: row.goalsConceded,
    averageRating: Number(ratingsByPlayer.get(row.playerId)?._avg.rating?.toFixed(2) ?? 0),
    ratingsCount: ratingsByPlayer.get(row.playerId)?._count.rating ?? 0,
  }));

  const confirmedByPlayer = await db().matchParticipant.groupBy({
    by: ["playerId"],
    where: {
      presenceStatus: PresenceStatus.CONFIRMED,
      matchId: { in: matchIds },
    },
    _count: { _all: true },
  });
  const confirmedMap = new Map(confirmedByPlayer.map((item) => [item.playerId, item._count._all]));
  const attendance = rows
    .map((row) => {
      const confirmed = confirmedMap.get(row.playerId) ?? 0;
      const attendancePercentage =
        totalMatches > 0 ? Number(((confirmed / totalMatches) * 100).toFixed(1)) : 0;

      return {
        playerId: row.playerId,
        playerName: row.playerName,
        confirmed,
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

  for (const participant of resultParticipants) {
    if (participant.match.teamAScore === null || participant.match.teamBScore === null) continue;

    for (const team of normalizeTeams(participant.teams)) {
      const ownScore = team === "A" ? participant.match.teamAScore : participant.match.teamBScore;
      const opponentScore = team === "A" ? participant.match.teamBScore : participant.match.teamAScore;
      const points = ownScore > opponentScore ? 3 : ownScore === opponentScore ? 1 : 0;

      const existing = performanceMap.get(participant.playerId) ?? {
        playerId: participant.playerId,
        playerName: playerById.get(participant.playerId)?.name ?? "Jogador",
        points: 0,
        matchesWithResult: 0,
        efficiency: 0,
      };

      existing.points += points;
      existing.matchesWithResult += 1;
      performanceMap.set(participant.playerId, existing);
    }
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
    totalGoals: totals._sum.goals ?? 0,
    totalAssists: totals._sum.assists ?? 0,
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
  const today = startOfToday();
  const finishedMatchWhere = finishedMatchWhereClause(today);
  const player = await db().player.findUnique({ where: { id: playerId } });

  if (!player) {
    return null;
  }

  const stats = await db().matchParticipant.aggregate({
    where: {
      playerId,
      presenceStatus: PresenceStatus.CONFIRMED,
      match: finishedMatchWhere,
    },
    _sum: {
      goals: true,
      assists: true,
      goalsConceded: true,
    },
    _count: { _all: true },
  });

  const ratings = await db().matchRating.aggregate({
    where: {
      ratedPlayerId: playerId,
      match: finishedMatchWhere,
    },
    _avg: { rating: true },
    _count: { _all: true },
  });

  const history = await db().matchParticipant.findMany({
    where: {
      playerId,
      presenceStatus: PresenceStatus.CONFIRMED,
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

  let wins = 0;
  let losses = 0;
  let draws = 0;
  let resultMatches = 0;

  for (const item of history) {
    if (item.match.teamAScore === null || item.match.teamBScore === null) continue;

    for (const team of normalizeTeams(item.teams)) {
      resultMatches += 1;

      const ownScore = team === "A" ? item.match.teamAScore : item.match.teamBScore;
      const opponentScore = team === "A" ? item.match.teamBScore : item.match.teamAScore;

      if (ownScore > opponentScore) wins += 1;
      else if (ownScore < opponentScore) losses += 1;
      else draws += 1;
    }
  }

  const matches = stats._count._all;
  const goals = stats._sum.goals ?? 0;
  const assists = stats._sum.assists ?? 0;
  const goalsConceded = stats._sum.goalsConceded ?? 0;
  const avgRating = Number(ratings._avg.rating?.toFixed(2) ?? 0);
  const ratingsCount = ratings._count._all;
  const goalsPerMatch = matches > 0 ? Number((goals / matches).toFixed(2)) : 0;
  const avgGoalsPerMatch = matches > 0 ? Number((goals / matches).toFixed(2)) : 0;
  const avgAssistsPerMatch = matches > 0 ? Number((assists / matches).toFixed(2)) : 0;
  const avgConcededPerMatch = matches > 0 ? Number((goalsConceded / matches).toFixed(2)) : 0;
  const efficiency =
    resultMatches > 0 ? Number((((wins * 3 + draws) / (resultMatches * 3)) * 100).toFixed(1)) : 0;

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
    history,
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



