import { UserRole, UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth-user";
import { getPrismaClient } from "@/lib/db";
import { userRoleUpdateSchema } from "@/lib/validators";

const db = () => getPrismaClient();

async function hasAnotherActiveAdmin(excludedUserId: string) {
  const total = await db().user.count({
    where: {
      id: { not: excludedUserId },
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  return total > 0;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = userRoleUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await db().user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      status: true,
      playerId: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  }

  if (user.status !== UserStatus.ACTIVE) {
    return NextResponse.json({ error: "Somente usuarios ativos podem trocar de perfil." }, { status: 409 });
  }

  if (parsed.data.role === UserRole.ADMIN && !user.playerId) {
    return NextResponse.json({ error: "Vincule um jogador antes de promover para admin." }, { status: 409 });
  }

  if (user.role === UserRole.ADMIN && parsed.data.role === UserRole.PLAYER) {
    const canDemote = await hasAnotherActiveAdmin(user.id);

    if (!canDemote) {
      return NextResponse.json({ error: "Nao e possivel rebaixar o ultimo admin ativo." }, { status: 409 });
    }
  }

  const updatedUser = await db().user.update({
    where: { id: user.id },
    data: {
      role: parsed.data.role,
      sessionVersion: {
        increment: 1,
      },
    },
    select: {
      id: true,
      role: true,
      status: true,
    },
  });

  await db().session.deleteMany({
    where: { userId: user.id },
  });

  return NextResponse.json(updatedUser);
}
