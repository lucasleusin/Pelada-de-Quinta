import { PresenceStatus, Prisma, Team, UserRole, UserStatus } from "@prisma/client";
import { getPrimaryTeam, normalizeTeams, sumTeamSplitStats } from "@/lib/team-utils";

export type MergeEntitiesInput = {
  primaryPlayerId?: string | null;
  secondaryPlayerId?: string | null;
};

export type MergeAccountOutcome =
  | "keep-primary-account"
  | "move-secondary-account-to-primary-player"
  | "no-account";

type TxClient = Prisma.TransactionClient;
type MergeRootClient = {
  $transaction<T>(callback: (tx: TxClient) => Promise<T>): Promise<T>;
};

type LoadedPlayer = Prisma.PlayerGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        email: true;
        name: true;
        role: true;
        status: true;
        playerId: true;
        mergedIntoUserId: true;
      };
    };
  };
}>;

type ParticipantLike = {
  presenceStatus: PresenceStatus;
  confirmedAt: Date | null;
  teams: Team[];
  primaryTeam: Team | null;
  playedAsGoalkeeper: boolean;
  teamAGoals: number;
  teamAAssists: number;
  teamAGoalsConceded: number;
  teamBGoals: number;
  teamBAssists: number;
  teamBGoalsConceded: number;
  statsUpdatedByPlayerId: string | null;
};

type RatingLike = {
  id: string;
  matchId: string;
  raterPlayerId: string;
  ratedPlayerId: string;
  rating: number;
  createdAt: Date;
};

type SelectionContext = {
  primaryPlayer: LoadedPlayer;
  secondaryPlayer: LoadedPlayer;
};

type PlayerMergeSummary = {
  participants: number;
  overlappingMatches: number;
  ratingsGiven: number;
  ratingsReceived: number;
  whatsAppMessages: number;
};

export type MergePreview = {
  playerMerge: {
    primary: {
      id: string;
      label: string;
      email: string | null;
      linkedUserEmail: string | null;
    };
    secondary: {
      id: string;
      label: string;
      email: string | null;
      linkedUserEmail: string | null;
    };
    summary: PlayerMergeSummary;
    accountOutcome: MergeAccountOutcome;
  };
  warnings: string[];
};

export class MergeValidationError extends Error {
  status: number;

  constructor(message: string, status = 409) {
    super(message);
    this.name = "MergeValidationError";
    this.status = status;
  }
}

const presenceStatusRank: Record<PresenceStatus, number> = {
  CONFIRMED: 3,
  WAITLIST: 2,
  CANCELED: 1,
};

function ensure(condition: unknown, message: string, status = 409): asserts condition {
  if (!condition) {
    throw new MergeValidationError(message, status);
  }
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

function playerLabel(player: Pick<LoadedPlayer, "name" | "nickname">) {
  return player.nickname ? `${player.nickname} (${player.name})` : player.name;
}

function strongerPresenceStatus(primaryStatus: PresenceStatus, secondaryStatus: PresenceStatus) {
  return presenceStatusRank[primaryStatus] >= presenceStatusRank[secondaryStatus] ? primaryStatus : secondaryStatus;
}

export function resolveMergeAccountOutcome(primaryHasUser: boolean, secondaryHasUser: boolean): MergeAccountOutcome {
  if (primaryHasUser) {
    return "keep-primary-account";
  }

  if (secondaryHasUser) {
    return "move-secondary-account-to-primary-player";
  }

  return "no-account";
}

function pickEarliestDate(values: Array<Date | null | undefined>) {
  const validDates = values.filter((value): value is Date => value instanceof Date);
  if (validDates.length === 0) return null;
  return validDates.reduce((earliest, current) => (current < earliest ? current : earliest));
}

function resolveMergedPrimaryTeam(primary: ParticipantLike, secondary: ParticipantLike, teams: Team[]) {
  const primaryPreferred = getPrimaryTeam(primary.primaryTeam, primary.teams);
  if (primaryPreferred && teams.includes(primaryPreferred)) {
    return primaryPreferred;
  }

  const secondaryPreferred = getPrimaryTeam(secondary.primaryTeam, secondary.teams);
  if (secondaryPreferred && teams.includes(secondaryPreferred)) {
    return secondaryPreferred;
  }

  return getPrimaryTeam(null, teams);
}

export function mergeParticipantRecords(primary: ParticipantLike, secondary: ParticipantLike) {
  const teams = normalizeTeams([...primary.teams, ...secondary.teams]) as Team[];
  const splitStats = {
    teamAGoals: primary.teamAGoals + secondary.teamAGoals,
    teamAAssists: primary.teamAAssists + secondary.teamAAssists,
    teamAGoalsConceded: primary.teamAGoalsConceded + secondary.teamAGoalsConceded,
    teamBGoals: primary.teamBGoals + secondary.teamBGoals,
    teamBAssists: primary.teamBAssists + secondary.teamBAssists,
    teamBGoalsConceded: primary.teamBGoalsConceded + secondary.teamBGoalsConceded,
  };
  const totals = sumTeamSplitStats(splitStats);
  const presenceStatus = strongerPresenceStatus(primary.presenceStatus, secondary.presenceStatus);

  return {
    presenceStatus,
    confirmedAt:
      presenceStatus === PresenceStatus.CONFIRMED
        ? pickEarliestDate([primary.confirmedAt, secondary.confirmedAt])
        : null,
    teams,
    primaryTeam: resolveMergedPrimaryTeam(primary, secondary, teams),
    playedAsGoalkeeper: primary.playedAsGoalkeeper || secondary.playedAsGoalkeeper,
    statsUpdatedByPlayerId: primary.statsUpdatedByPlayerId ?? secondary.statsUpdatedByPlayerId ?? null,
    ...splitStats,
    ...totals,
  };
}

export function planMergedRatings(ratings: RatingLike[], primaryPlayerId: string, secondaryPlayerId: string) {
  const updates: Array<{ id: string; raterPlayerId: string; ratedPlayerId: string }> = [];
  const deletions = new Set<string>();
  const grouped = new Map<string, Array<RatingLike & { nextRaterPlayerId: string; nextRatedPlayerId: string }>>();

  for (const rating of ratings) {
    const nextRaterPlayerId = rating.raterPlayerId === secondaryPlayerId ? primaryPlayerId : rating.raterPlayerId;
    const nextRatedPlayerId = rating.ratedPlayerId === secondaryPlayerId ? primaryPlayerId : rating.ratedPlayerId;

    if (nextRaterPlayerId === nextRatedPlayerId) {
      deletions.add(rating.id);
      continue;
    }

    const key = `${rating.matchId}:${nextRaterPlayerId}:${nextRatedPlayerId}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push({ ...rating, nextRaterPlayerId, nextRatedPlayerId });
    grouped.set(key, bucket);
  }

  for (const bucket of grouped.values()) {
    const [keeper, ...rest] = [...bucket].sort((left, right) => {
      if (right.rating !== left.rating) {
        return right.rating - left.rating;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    });

    for (const item of rest) {
      deletions.add(item.id);
    }

    if (keeper.raterPlayerId !== keeper.nextRaterPlayerId || keeper.ratedPlayerId !== keeper.nextRatedPlayerId) {
      updates.push({
        id: keeper.id,
        raterPlayerId: keeper.nextRaterPlayerId,
        ratedPlayerId: keeper.nextRatedPlayerId,
      });
    }
  }

  return {
    updates,
    deletions: Array.from(deletions),
  };
}

function buildWarnings(context: SelectionContext) {
  const accountOutcome = resolveMergeAccountOutcome(Boolean(context.primaryPlayer.user), Boolean(context.secondaryPlayer.user));
  const warnings = [
    "A unificacao e definitiva. O jogador secundario sera ocultado para uso normal.",
    "Todo o historico esportivo do jogador secundario sera movido para o principal.",
  ];

  if (accountOutcome === "keep-primary-account" && context.secondaryPlayer.user) {
    warnings.push("Se houver conta vinculada no jogador secundario, ela sera bloqueada e a conta do principal sera mantida.");
  }

  if (accountOutcome === "move-secondary-account-to-primary-player" && context.secondaryPlayer.user) {
    warnings.push("A conta vinculada do jogador secundario sera transferida para o jogador principal.");
  }

  return warnings;
}

async function loadSelectionContext(
  client: Prisma.TransactionClient | { player: TxClient["player"] },
  input: MergeEntitiesInput,
): Promise<SelectionContext> {
  const explicitPlayerIds = uniqueValues([input.primaryPlayerId, input.secondaryPlayerId]);
  const players = explicitPlayerIds.length > 0
    ? await client.player.findMany({
        where: {
          id: { in: explicitPlayerIds },
          mergedIntoPlayerId: null,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              status: true,
              playerId: true,
              mergedIntoUserId: true,
            },
          },
        },
      })
    : [];

  const playerById = new Map(players.map((player) => [player.id, player]));
  const primaryPlayer = input.primaryPlayerId ? playerById.get(input.primaryPlayerId) ?? null : null;
  const secondaryPlayer = input.secondaryPlayerId ? playerById.get(input.secondaryPlayerId) ?? null : null;

  ensure(primaryPlayer, "Jogador principal nao encontrado ou ja foi unificado.", 404);
  ensure(secondaryPlayer, "Jogador secundario nao encontrado ou ja foi unificado.", 404);

  return {
    primaryPlayer,
    secondaryPlayer,
  };
}

async function getPlayerMergeSummary(client: TxClient, primaryPlayerId: string, secondaryPlayerId: string): Promise<PlayerMergeSummary> {
  const [primaryParticipants, secondaryParticipants, ratingsGiven, ratingsReceived, whatsAppMessages] = await Promise.all([
    client.matchParticipant.findMany({
      where: { playerId: primaryPlayerId },
      select: { matchId: true },
    }),
    client.matchParticipant.findMany({
      where: { playerId: secondaryPlayerId },
      select: { matchId: true },
    }),
    client.matchRating.count({
      where: { raterPlayerId: secondaryPlayerId },
    }),
    client.matchRating.count({
      where: { ratedPlayerId: secondaryPlayerId },
    }),
    client.whatsAppMessageLog.count({
      where: { playerId: secondaryPlayerId },
    }),
  ]);

  const primaryMatchIds = new Set(primaryParticipants.map((participant) => participant.matchId));
  const overlappingMatches = secondaryParticipants.reduce(
    (total, participant) => total + (primaryMatchIds.has(participant.matchId) ? 1 : 0),
    0,
  );

  return {
    participants: secondaryParticipants.length,
    overlappingMatches,
    ratingsGiven,
    ratingsReceived,
    whatsAppMessages,
  };
}

export async function listMergeCandidates(client: TxClient) {
  const players = await client.player.findMany({
    where: { mergedIntoPlayerId: null },
    orderBy: [{ name: "asc" }],
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          playerId: true,
          mergedIntoUserId: true,
        },
      },
    },
  });

  return {
    players: players.map((player) => ({
      id: player.id,
      name: player.name,
      nickname: player.nickname,
      email: player.email,
      isActive: player.isActive,
      user: player.user?.mergedIntoUserId ? null : player.user,
    })),
  };
}

export async function previewEntityMerge(client: TxClient, input: MergeEntitiesInput): Promise<MergePreview> {
  const context = await loadSelectionContext(client, input);
  const accountOutcome = resolveMergeAccountOutcome(Boolean(context.primaryPlayer.user), Boolean(context.secondaryPlayer.user));

  return {
    playerMerge: {
      primary: {
        id: context.primaryPlayer.id,
        label: playerLabel(context.primaryPlayer),
        email: context.primaryPlayer.email,
        linkedUserEmail: context.primaryPlayer.user?.email ?? null,
      },
      secondary: {
        id: context.secondaryPlayer.id,
        label: playerLabel(context.secondaryPlayer),
        email: context.secondaryPlayer.email,
        linkedUserEmail: context.secondaryPlayer.user?.email ?? null,
      },
      summary: await getPlayerMergeSummary(client, context.primaryPlayer.id, context.secondaryPlayer.id),
      accountOutcome,
    },
    warnings: buildWarnings(context),
  };
}

async function reconcileLinkedUsersAfterPlayerMerge(tx: TxClient, mergedByUserId: string, context: SelectionContext, mergedAt: Date) {
  const primaryUser = context.primaryPlayer.user;
  const secondaryUser = context.secondaryPlayer.user;
  const accountOutcome = resolveMergeAccountOutcome(Boolean(primaryUser), Boolean(secondaryUser));

  if (!secondaryUser) {
    return {
      accountOutcome,
      keptUserId: primaryUser?.id ?? null,
      disabledUserId: null,
      movedUserId: null,
    };
  }

  if (!primaryUser) {
    await tx.user.update({
      where: { id: secondaryUser.id },
      data: {
        playerId: context.primaryPlayer.id,
      },
    });

    return {
      accountOutcome,
      keptUserId: secondaryUser.id,
      disabledUserId: null,
      movedUserId: secondaryUser.id,
    };
  }

  if (primaryUser.id === secondaryUser.id) {
    return {
      accountOutcome,
      keptUserId: primaryUser.id,
      disabledUserId: null,
      movedUserId: null,
    };
  }

  if (secondaryUser.role === UserRole.ADMIN && secondaryUser.status === UserStatus.ACTIVE) {
    const remainingActiveAdmins = await tx.user.count({
      where: {
        id: { not: secondaryUser.id },
        mergedIntoUserId: null,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    ensure(remainingActiveAdmins > 0, "Nao e possivel desativar o ultimo admin ativo.", 409);
  }

  await tx.user.update({
    where: { id: secondaryUser.id },
    data: {
      status: UserStatus.DISABLED,
      playerId: null,
      mustChangePassword: false,
      mergedIntoUserId: primaryUser.id,
      mergedAt,
      mergedByUserId,
      sessionVersion: {
        increment: 1,
      },
    },
  });

  await tx.session.deleteMany({
    where: { userId: secondaryUser.id },
  });

  return {
    accountOutcome,
    keptUserId: primaryUser.id,
    disabledUserId: secondaryUser.id,
    movedUserId: null,
  };
}

async function mergePlayers(tx: TxClient, mergedByUserId: string, context: SelectionContext, mergedAt: Date) {
  const primaryPlayer = context.primaryPlayer;
  const secondaryPlayer = context.secondaryPlayer;

  const participantRecords = await tx.matchParticipant.findMany({
    where: {
      playerId: {
        in: [primaryPlayer.id, secondaryPlayer.id],
      },
    },
  });
  const primaryParticipantsByMatchId = new Map(
    participantRecords
      .filter((participant) => participant.playerId === primaryPlayer.id)
      .map((participant) => [participant.matchId, participant]),
  );
  const secondaryParticipants = participantRecords.filter((participant) => participant.playerId === secondaryPlayer.id);

  for (const secondaryParticipant of secondaryParticipants) {
    const primaryParticipant = primaryParticipantsByMatchId.get(secondaryParticipant.matchId);

    if (primaryParticipant) {
      const mergedParticipant = mergeParticipantRecords(primaryParticipant, secondaryParticipant);

      await tx.matchParticipant.update({
        where: { id: primaryParticipant.id },
        data: mergedParticipant,
      });

      await tx.matchParticipant.delete({
        where: { id: secondaryParticipant.id },
      });
      continue;
    }

    await tx.matchParticipant.update({
      where: { id: secondaryParticipant.id },
      data: { playerId: primaryPlayer.id },
    });
  }

  await tx.matchParticipant.updateMany({
    where: { statsUpdatedByPlayerId: secondaryPlayer.id },
    data: { statsUpdatedByPlayerId: primaryPlayer.id },
  });

  const ratings = await tx.matchRating.findMany({
    where: {
      OR: [
        { raterPlayerId: { in: [primaryPlayer.id, secondaryPlayer.id] } },
        { ratedPlayerId: { in: [primaryPlayer.id, secondaryPlayer.id] } },
      ],
    },
  });
  const ratingPlan = planMergedRatings(ratings, primaryPlayer.id, secondaryPlayer.id);

  if (ratingPlan.deletions.length > 0) {
    await tx.matchRating.deleteMany({
      where: {
        id: { in: ratingPlan.deletions },
      },
    });
  }

  for (const update of ratingPlan.updates) {
    await tx.matchRating.update({
      where: { id: update.id },
      data: {
        raterPlayerId: update.raterPlayerId,
        ratedPlayerId: update.ratedPlayerId,
      },
    });
  }

  await tx.whatsAppMessageLog.updateMany({
    where: { playerId: secondaryPlayer.id },
    data: { playerId: primaryPlayer.id },
  });

  const mergedUsers = await reconcileLinkedUsersAfterPlayerMerge(tx, mergedByUserId, context, mergedAt);

  await tx.player.update({
    where: { id: secondaryPlayer.id },
    data: {
      isActive: false,
      mergedIntoPlayerId: primaryPlayer.id,
      mergedAt,
      mergedByUserId,
    },
  });

  return {
    primaryPlayerId: primaryPlayer.id,
    secondaryPlayerId: secondaryPlayer.id,
    mergedUsers,
  };
}

export async function executeEntityMerge(client: MergeRootClient, mergedByUserId: string, input: MergeEntitiesInput) {
  return client.$transaction(async (tx) => {
    const context = await loadSelectionContext(tx, input);
    const mergedAt = new Date();
    const mergedPlayers = await mergePlayers(tx, mergedByUserId, context, mergedAt);

    return {
      ok: true,
      mergedPlayers,
    };
  });
}

