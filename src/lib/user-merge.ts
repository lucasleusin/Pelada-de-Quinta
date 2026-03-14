import { PresenceStatus, Prisma, Team, UserRole, UserStatus } from "@prisma/client";
import { getPrimaryTeam, normalizeTeams, sumTeamSplitStats } from "@/lib/team-utils";

export type MergeEntitiesInput = {
  primaryUserId?: string | null;
  secondaryUserId?: string | null;
  primaryPlayerId?: string | null;
  secondaryPlayerId?: string | null;
};

type TxClient = Prisma.TransactionClient;
type MergeRootClient = {
  $transaction<T>(callback: (tx: TxClient) => Promise<T>): Promise<T>;
};

type LoadedUser = Prisma.UserGetPayload<{
  include: {
    accounts: {
      select: {
        provider: true;
        providerAccountId: true;
      };
    };
    player: {
      select: {
        id: true;
        name: true;
        nickname: true;
      };
    };
  };
}>;

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
  primaryUser: LoadedUser | null;
  secondaryUser: LoadedUser | null;
  primaryPlayer: LoadedPlayer | null;
  secondaryPlayer: LoadedPlayer | null;
};

type PlayerMergeSummary = {
  participants: number;
  overlappingMatches: number;
  ratingsGiven: number;
  ratingsReceived: number;
  whatsAppMessages: number;
};

export type MergePreview = {
  userMerge: null | {
    primary: {
      id: string;
      label: string;
      email: string;
      role: UserRole;
      status: UserStatus;
      playerLabel: string | null;
    };
    secondary: {
      id: string;
      label: string;
      email: string;
      role: UserRole;
      status: UserStatus;
      playerLabel: string | null;
      loginMethods: string[];
    };
    result: {
      role: UserRole;
      status: UserStatus;
      passwordAction: "keep-primary" | "move-secondary" | "none";
      finalEmail: string;
    };
  };
  playerMerge: null | {
    primary: {
      id: string;
      label: string;
      email: string | null;
    };
    secondary: {
      id: string;
      label: string;
      email: string | null;
    };
    summary: PlayerMergeSummary;
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

const userStatusRank: Record<UserStatus, number> = {
  ACTIVE: 5,
  PENDING_APPROVAL: 4,
  PENDING_VERIFICATION: 3,
  REJECTED: 2,
  DISABLED: 1,
};

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

function userLabel(user: Pick<LoadedUser, "name" | "email">) {
  return user.name?.trim() ? user.name : user.email;
}

function playerLabel(player: Pick<LoadedPlayer, "name" | "nickname">) {
  return player.nickname ? `${player.nickname} (${player.name})` : player.name;
}

function strongerRole(primaryRole: UserRole, secondaryRole: UserRole) {
  return primaryRole === UserRole.ADMIN || secondaryRole === UserRole.ADMIN ? UserRole.ADMIN : UserRole.PLAYER;
}

function strongerStatus(primaryStatus: UserStatus, secondaryStatus: UserStatus) {
  return userStatusRank[primaryStatus] >= userStatusRank[secondaryStatus] ? primaryStatus : secondaryStatus;
}

function strongerPresenceStatus(primaryStatus: PresenceStatus, secondaryStatus: PresenceStatus) {
  return presenceStatusRank[primaryStatus] >= presenceStatusRank[secondaryStatus] ? primaryStatus : secondaryStatus;
}

function getPasswordAction(primary: LoadedUser, secondary: LoadedUser) {
  if (primary.passwordHash) {
    return "keep-primary" as const;
  }

  if (secondary.passwordHash) {
    return "move-secondary" as const;
  }

  return "none" as const;
}

function getLoginMethods(user: LoadedUser) {
  const methods = new Set<string>();

  if (user.passwordHash) {
    methods.add("email/senha");
  }

  for (const account of user.accounts) {
    if (account.provider === "google") {
      methods.add("Google");
      continue;
    }

    if (account.provider === "microsoft-entra-id") {
      methods.add("Microsoft");
      continue;
    }

    methods.add(account.provider);
  }

  return Array.from(methods);
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
    confirmedAt: presenceStatus === PresenceStatus.CONFIRMED
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
  const warnings = [
    "A unificacao e definitiva. O registro secundario sera ocultado e bloqueado para uso normal.",
  ];

  if (context.secondaryUser) {
    warnings.push("Depois da fusao, o login por email/senha da conta secundaria deixara de ser aceito.");
  }

  if (context.secondaryPlayer) {
    warnings.push("O historico esportivo do jogador secundario sera movido para o principal e o secundario ficara oculto.");
  }

  return warnings;
}

async function loadSelectionContext(client: Prisma.TransactionClient | { user: TxClient["user"]; player: TxClient["player"] }, input: MergeEntitiesInput) {
  const explicitUserIds = uniqueValues([input.primaryUserId, input.secondaryUserId]);

  const users = explicitUserIds.length > 0
    ? await client.user.findMany({
        where: {
          id: { in: explicitUserIds },
          mergedIntoUserId: null,
        },
        include: {
          accounts: {
            select: {
              provider: true,
              providerAccountId: true,
            },
          },
          player: {
            select: {
              id: true,
              name: true,
              nickname: true,
            },
          },
        },
      })
    : [];

  const userById = new Map(users.map((user) => [user.id, user]));
  const primaryUser = input.primaryUserId ? userById.get(input.primaryUserId) ?? null : null;
  const secondaryUser = input.secondaryUserId ? userById.get(input.secondaryUserId) ?? null : null;

  if (input.primaryUserId) {
    ensure(primaryUser, "Usuario principal nao encontrado ou ja foi unificado.", 404);
  }

  if (input.secondaryUserId) {
    ensure(secondaryUser, "Usuario secundario nao encontrado ou ja foi unificado.", 404);
  }

  const explicitPlayerIds = uniqueValues([
    input.primaryPlayerId,
    input.secondaryPlayerId,
    primaryUser?.playerId,
    secondaryUser?.playerId,
  ]);

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
            },
          },
        },
      })
    : [];

  const playerById = new Map(players.map((player) => [player.id, player]));
  const primaryPlayer = input.primaryPlayerId ? playerById.get(input.primaryPlayerId) ?? null : null;
  const secondaryPlayer = input.secondaryPlayerId ? playerById.get(input.secondaryPlayerId) ?? null : null;

  if (input.primaryPlayerId) {
    ensure(primaryPlayer, "Jogador principal nao encontrado ou ja foi unificado.", 404);
  }

  if (input.secondaryPlayerId) {
    ensure(secondaryPlayer, "Jogador secundario nao encontrado ou ja foi unificado.", 404);
  }

  if (primaryUser?.playerId && primaryPlayer && primaryUser.playerId !== primaryPlayer.id) {
    throw new MergeValidationError("O usuario principal ja esta vinculado a outro jogador. Ajuste a selecao.", 409);
  }

  if (secondaryUser?.playerId && secondaryPlayer && secondaryUser.playerId !== secondaryPlayer.id) {
    throw new MergeValidationError("O usuario secundario ja esta vinculado a outro jogador. Ajuste a selecao.", 409);
  }

  if (primaryUser && secondaryUser && !primaryPlayer && !secondaryPlayer) {
    if (primaryUser.playerId && secondaryUser.playerId && primaryUser.playerId !== secondaryUser.playerId) {
      throw new MergeValidationError("Essas contas estao ligadas a jogadores diferentes. Selecione tambem os jogadores para unificar.", 409);
    }
  }

  if (primaryPlayer && secondaryPlayer) {
    if (!primaryUser && !secondaryUser) {
      if (primaryPlayer.user && secondaryPlayer.user && primaryPlayer.user.id !== secondaryPlayer.user.id) {
        throw new MergeValidationError("Os dois jogadores possuem contas diferentes vinculadas. Unifique tambem os usuarios.", 409);
      }
    } else {
      const allowedUserIds = new Set(uniqueValues([primaryUser?.id, secondaryUser?.id]));

      if (primaryPlayer.user && !allowedUserIds.has(primaryPlayer.user.id)) {
        throw new MergeValidationError("O jogador principal esta vinculado a outro usuario fora desta unificacao.", 409);
      }

      if (secondaryPlayer.user && !allowedUserIds.has(secondaryPlayer.user.id)) {
        throw new MergeValidationError("O jogador secundario esta vinculado a outro usuario fora desta unificacao.", 409);
      }
    }
  }

  return {
    primaryUser,
    secondaryUser,
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
  const [users, players] = await Promise.all([
    client.user.findMany({
      where: { mergedIntoUserId: null },
      orderBy: [{ createdAt: "asc" }],
      include: {
        accounts: {
          select: {
            provider: true,
            providerAccountId: true,
          },
        },
        player: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
      },
    }),
    client.player.findMany({
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
          },
        },
      },
    }),
  ]);

  return {
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      playerId: user.playerId,
      player: user.player,
      loginMethods: getLoginMethods(user),
      createdAt: user.createdAt,
    })),
    players: players.map((player) => ({
      id: player.id,
      name: player.name,
      nickname: player.nickname,
      email: player.email,
      isActive: player.isActive,
      user: player.user,
    })),
  };
}

export async function previewEntityMerge(client: TxClient, input: MergeEntitiesInput): Promise<MergePreview> {
  const context = await loadSelectionContext(client, input);

  return {
    userMerge: context.primaryUser && context.secondaryUser
      ? {
          primary: {
            id: context.primaryUser.id,
            label: userLabel(context.primaryUser),
            email: context.primaryUser.email,
            role: context.primaryUser.role,
            status: context.primaryUser.status,
            playerLabel: context.primaryUser.player ? playerLabel(context.primaryUser.player) : null,
          },
          secondary: {
            id: context.secondaryUser.id,
            label: userLabel(context.secondaryUser),
            email: context.secondaryUser.email,
            role: context.secondaryUser.role,
            status: context.secondaryUser.status,
            playerLabel: context.secondaryUser.player ? playerLabel(context.secondaryUser.player) : null,
            loginMethods: getLoginMethods(context.secondaryUser),
          },
          result: {
            role: strongerRole(context.primaryUser.role, context.secondaryUser.role),
            status: strongerStatus(context.primaryUser.status, context.secondaryUser.status),
            passwordAction: getPasswordAction(context.primaryUser, context.secondaryUser),
            finalEmail: context.primaryUser.email,
          },
        }
      : null,
    playerMerge: context.primaryPlayer && context.secondaryPlayer
      ? {
          primary: {
            id: context.primaryPlayer.id,
            label: playerLabel(context.primaryPlayer),
            email: context.primaryPlayer.email,
          },
          secondary: {
            id: context.secondaryPlayer.id,
            label: playerLabel(context.secondaryPlayer),
            email: context.secondaryPlayer.email,
          },
          summary: await getPlayerMergeSummary(client, context.primaryPlayer.id, context.secondaryPlayer.id),
        }
      : null,
    warnings: buildWarnings(context),
  };
}

function resolvePrimaryUserPlayerId(context: SelectionContext) {
  if (context.primaryPlayer && context.secondaryPlayer) {
    return context.primaryPlayer.id;
  }

  return context.primaryUser?.playerId ?? context.secondaryUser?.playerId ?? null;
}

async function mergeUsers(tx: TxClient, mergedByUserId: string, context: SelectionContext, mergedAt: Date) {
  const primaryUser = context.primaryUser;
  const secondaryUser = context.secondaryUser;

  if (!primaryUser || !secondaryUser) {
    return null;
  }

  const finalPlayerId = resolvePrimaryUserPlayerId(context);
  const finalRole = strongerRole(primaryUser.role, secondaryUser.role);

  if (finalRole === UserRole.ADMIN) {
    ensure(finalPlayerId, "O usuario final precisa ficar vinculado a um jogador para manter perfil admin.");
  }

  const finalStatus = strongerStatus(primaryUser.status, secondaryUser.status);
  const passwordAction = getPasswordAction(primaryUser, secondaryUser);
  const finalPasswordHash = passwordAction === "move-secondary"
    ? secondaryUser.passwordHash
    : primaryUser.passwordHash;

  await tx.account.updateMany({
    where: { userId: secondaryUser.id },
    data: { userId: primaryUser.id },
  });

  await tx.user.update({
    where: { id: primaryUser.id },
    data: {
      role: finalRole,
      status: finalStatus,
      playerId: finalPlayerId,
      passwordHash: finalPasswordHash ?? undefined,
      mustChangePassword: primaryUser.mustChangePassword || secondaryUser.mustChangePassword,
      emailVerified:
        primaryUser.emailVerified ?? (primaryUser.email === secondaryUser.email ? secondaryUser.emailVerified : null),
      sessionVersion: {
        increment: 1,
      },
    },
  });

  await tx.user.update({
    where: { id: secondaryUser.id },
    data: {
      status: UserStatus.DISABLED,
      playerId: null,
      passwordHash: null,
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
    where: {
      userId: { in: [primaryUser.id, secondaryUser.id] },
    },
  });

  return {
    primaryUserId: primaryUser.id,
    secondaryUserId: secondaryUser.id,
  };
}

async function mergePlayers(tx: TxClient, mergedByUserId: string, context: SelectionContext, mergedAt: Date) {
  const primaryPlayer = context.primaryPlayer;
  const secondaryPlayer = context.secondaryPlayer;

  if (!primaryPlayer || !secondaryPlayer) {
    return null;
  }

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

  if (!context.primaryUser && !context.secondaryUser && secondaryPlayer.user && !primaryPlayer.user) {
    await tx.user.update({
      where: { id: secondaryPlayer.user.id },
      data: {
        playerId: primaryPlayer.id,
        sessionVersion: {
          increment: 1,
        },
      },
    });
  }

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
  };
}

export async function executeEntityMerge(client: MergeRootClient, mergedByUserId: string, input: MergeEntitiesInput) {
  return client.$transaction(async (tx) => {
    const context = await loadSelectionContext(tx, input);
    const mergedAt = new Date();

    const mergedUsers = await mergeUsers(tx, mergedByUserId, context, mergedAt);
    const mergedPlayers = await mergePlayers(tx, mergedByUserId, context, mergedAt);

    return {
      ok: true,
      mergedUsers,
      mergedPlayers,
    };
  });
}
