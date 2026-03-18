import { NextResponse } from "next/server";
import { UserRole, UserStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { getPrismaClient } from "@/lib/db";
import { reconcileLegacyUserState } from "@/lib/user-player-link";

const db = () => getPrismaClient();

export type AuthenticatedUser = Awaited<ReturnType<typeof getCurrentUser>>;

export async function getCurrentUser() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  await reconcileLegacyUserState(db(), userId);

  return db().user.findUnique({
    where: { id: userId },
    include: {
      player: true,
    },
  });
}

export async function requireAuthenticatedApi() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Nao autenticado." }, { status: 401 }),
    };
  }

  return { ok: true as const, user };
}

export async function requireAdminApi() {
  const authCheck = await requireAuthenticatedApi();

  if (!authCheck.ok) {
    return authCheck;
  }

  if (authCheck.user.role !== UserRole.ADMIN || authCheck.user.status !== UserStatus.ACTIVE) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Administrador invalido." }, { status: 403 }),
    };
  }

  return authCheck;
}

export async function requireActivePlayerApi() {
  const authCheck = await requireAuthenticatedApi();

  if (!authCheck.ok) {
    return authCheck;
  }

  if (authCheck.user.mustChangePassword) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Troca de senha obrigatoria." }, { status: 403 }),
    };
  }

  if (authCheck.user.status !== UserStatus.ACTIVE || !authCheck.user.playerId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Conta indisponivel para as areas do atleta." }, { status: 403 }),
    };
  }

  return authCheck;
}

export async function resolveCurrentPlayerId(id: string) {
  if (id !== "me") {
    return id;
  }

  const authCheck = await requireActivePlayerApi();

  if (!authCheck.ok) {
    return authCheck;
  }

  return authCheck.user.playerId!;
}
