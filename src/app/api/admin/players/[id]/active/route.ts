import { UserRole, UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin";
import { activeToggleSchema } from "@/lib/validators";

async function hasAnotherActiveAdmin(prisma: ReturnType<typeof getPrismaClient>, excludedUserId: string) {
  const total = await prisma.user.count({
    where: {
      id: { not: excludedUserId },
      mergedIntoUserId: null,
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
  const parsed = activeToggleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const prisma = getPrismaClient();
  const player = await prisma.player.findFirst({
    where: {
      id,
      mergedIntoPlayerId: null,
    },
    select: {
      id: true,
      isActive: true,
      user: {
        select: {
          id: true,
          role: true,
          status: true,
          mergedIntoUserId: true,
        },
      },
    },
  });

  if (!player) {
    return NextResponse.json({ error: "Jogador nao encontrado." }, { status: 404 });
  }

  const linkedUser = player.user?.mergedIntoUserId ? null : player.user;

  if (!parsed.data.isActive && linkedUser?.role === UserRole.ADMIN && linkedUser.status === UserStatus.ACTIVE) {
    const canDisable = await hasAnotherActiveAdmin(prisma, linkedUser.id);

    if (!canDisable) {
      return NextResponse.json({ error: "Nao e possivel remover o ultimo admin ativo." }, { status: 409 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.player.update({
      where: { id: player.id },
      data: {
        isActive: parsed.data.isActive,
      },
    });

    if (!linkedUser) {
      return;
    }

    if (!parsed.data.isActive) {
      await tx.user.update({
        where: { id: linkedUser.id },
        data: {
          status: UserStatus.DISABLED,
          sessionVersion: {
            increment: 1,
          },
        },
      });

      await tx.session.deleteMany({
        where: { userId: linkedUser.id },
      });

      return;
    }

    if (linkedUser.status === UserStatus.DISABLED) {
      await tx.user.update({
        where: { id: linkedUser.id },
        data: {
          status: UserStatus.ACTIVE,
          sessionVersion: {
            increment: 1,
          },
        },
      });
    }
  });

  return NextResponse.json({
    ok: true,
    isActive: parsed.data.isActive,
    userStatus:
      !linkedUser
        ? null
        : parsed.data.isActive
          ? linkedUser.status === UserStatus.DISABLED
            ? UserStatus.ACTIVE
            : linkedUser.status
          : UserStatus.DISABLED,
  });
}
