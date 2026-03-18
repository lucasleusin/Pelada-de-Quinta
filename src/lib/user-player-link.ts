import { Position, Prisma, type PrismaClient, UserStatus } from "@prisma/client";

type DbLike = PrismaClient | Prisma.TransactionClient;

type UserSnapshot = {
  id: string;
  email: string;
  name: string | null;
  nickname: string | null;
  position: Position | null;
  shirtNumberPreference: number | null;
  whatsApp: string | null;
  playerId: string | null;
  status: UserStatus;
  mergedIntoUserId: string | null;
};

function derivePlayerName(user: Pick<UserSnapshot, "name" | "email" | "id">) {
  const explicitName = user.name?.trim();

  if (explicitName && explicitName.length >= 2) {
    return explicitName;
  }

  const localPart = user.email.split("@")[0]?.replace(/[._-]+/g, " ").trim();

  if (localPart && localPart.length >= 2) {
    return localPart
      .split(/\s+/)
      .map((chunk) => `${chunk.slice(0, 1).toUpperCase()}${chunk.slice(1)}`)
      .join(" ");
  }

  return `Atleta ${user.id.slice(-6)}`;
}

function buildPlayerPatch(user: UserSnapshot): Prisma.PlayerUpdateInput {
  return {
    isActive: true,
    name: user.name?.trim() || undefined,
    nickname: user.nickname ?? undefined,
    position: user.position ?? undefined,
    shirtNumberPreference: user.shirtNumberPreference ?? undefined,
    email: user.email,
    phone: user.whatsApp ?? undefined,
  };
}

function buildPlayerCreateData(user: UserSnapshot): Prisma.PlayerCreateInput {
  return {
    name: derivePlayerName(user),
    nickname: user.nickname ?? null,
    position: user.position ?? Position.OUTRO,
    shirtNumberPreference: user.shirtNumberPreference ?? null,
    email: user.email,
    phone: user.whatsApp ?? null,
    isActive: true,
  };
}

function getUniqueConstraintMessage(error: Prisma.PrismaClientKnownRequestError) {
  const targets = Array.isArray(error.meta?.target) ? error.meta.target : [];

  if (targets.includes("email")) {
    return "Ja existe um jogador com este email vinculado a outra conta.";
  }

  if (targets.includes("name")) {
    return "Ja existe um jogador com este nome. Fale com o administrador para revisar o vinculo.";
  }

  return "Nao foi possivel vincular sua conta a um jogador.";
}

async function loadUser(client: DbLike, userId: string) {
  return client.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      nickname: true,
      position: true,
      shirtNumberPreference: true,
      whatsApp: true,
      playerId: true,
      status: true,
      mergedIntoUserId: true,
    },
  });
}

export async function ensureUserHasLinkedPlayer(client: DbLike, userId: string) {
  const user = await loadUser(client, userId);

  if (!user) {
    throw new Error("Conta nao encontrada.");
  }

  if (user.mergedIntoUserId || user.playerId) {
    return user;
  }

  const existingPlayer = await client.player.findFirst({
    where: {
      email: user.email,
      mergedIntoPlayerId: null,
      user: { is: null },
    },
    select: { id: true },
  });

  let playerId = existingPlayer?.id ?? null;

  try {
    if (playerId) {
      await client.player.update({
        where: { id: playerId },
        data: buildPlayerPatch(user),
      });
    } else {
      const createdPlayer = await client.player.create({
        data: buildPlayerCreateData(user),
        select: { id: true },
      });

      playerId = createdPlayer.id;
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(getUniqueConstraintMessage(error));
    }

    throw error;
  }

  await client.user.update({
    where: { id: user.id },
    data: { playerId },
  });

  const linkedUser = await loadUser(client, userId);

  if (!linkedUser) {
    throw new Error("Conta nao encontrada.");
  }

  return linkedUser;
}

export async function reconcileLegacyUserState(client: DbLike, userId: string) {
  const user = await loadUser(client, userId);

  if (!user || user.mergedIntoUserId) {
    return user;
  }

  const needsPlayer = !user.playerId;
  const shouldPromote = user.status === UserStatus.PENDING_APPROVAL;

  if (!needsPlayer && !shouldPromote) {
    return user;
  }

  const linkedUser = needsPlayer ? await ensureUserHasLinkedPlayer(client, userId) : user;

  if (!shouldPromote) {
    return linkedUser;
  }

  await client.user.update({
    where: { id: userId },
    data: { status: UserStatus.ACTIVE },
  });

  return loadUser(client, userId);
}

export async function backfillLegacyPendingApprovalUsers(client: DbLike) {
  const users = await client.user.findMany({
    where: {
      mergedIntoUserId: null,
      OR: [
        { status: UserStatus.PENDING_APPROVAL },
        { status: UserStatus.PENDING_VERIFICATION, playerId: null },
        { status: UserStatus.ACTIVE, playerId: null },
      ],
    },
    select: { id: true },
  });

  for (const user of users) {
    try {
      await reconcileLegacyUserState(client, user.id);
    } catch (error) {
      console.error(`Falha ao reconciliar conta legada ${user.id}.`, error);
    }
  }
}

export async function activateUserWithLinkedPlayer(client: DbLike, userId: string) {
  const linkedUser = await ensureUserHasLinkedPlayer(client, userId);

  if (linkedUser.status === UserStatus.DISABLED || linkedUser.status === UserStatus.REJECTED) {
    return linkedUser;
  }

  if (linkedUser.status === UserStatus.ACTIVE) {
    return linkedUser;
  }

  await client.user.update({
    where: { id: userId },
    data: { status: UserStatus.ACTIVE },
  });

  return loadUser(client, userId);
}
