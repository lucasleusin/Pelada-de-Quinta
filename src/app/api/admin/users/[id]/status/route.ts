import { UserRole, UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth-user";
import { getPrismaClient } from "@/lib/db";
import { getDisabledReactivationStatus, getRejectedReopenStatus } from "@/lib/user-management";
import { userStatusUpdateSchema } from "@/lib/validators";

const db = () => getPrismaClient();

async function hasAnotherActiveAdmin(excludedUserId: string) {
  const total = await db().user.count({
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
  const parsed = userStatusUpdateSchema.safeParse(body);

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
      emailVerified: true,
      mergedIntoUserId: true,
    },
  });

  if (!user || user.mergedIntoUserId) {
    return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  }

  if (parsed.data.action === "disable") {
    if (user.status !== UserStatus.ACTIVE) {
      return NextResponse.json({ error: "Somente usuarios ativos podem ter o acesso removido." }, { status: 409 });
    }

    if (user.role === UserRole.ADMIN) {
      const canDisable = await hasAnotherActiveAdmin(user.id);

      if (!canDisable) {
        return NextResponse.json({ error: "Nao e possivel remover o ultimo admin ativo." }, { status: 409 });
      }
    }

    await db().$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: UserStatus.DISABLED,
          sessionVersion: {
            increment: 1,
          },
        },
      });

      await tx.session.deleteMany({
        where: { userId: user.id },
      });
    });

    return NextResponse.json({ ok: true, status: UserStatus.DISABLED });
  }

  if (parsed.data.action === "reactivate") {
    if (user.status !== UserStatus.DISABLED) {
      return NextResponse.json({ error: "Somente usuarios removidos podem ser reativados." }, { status: 409 });
    }

    const nextStatus = getDisabledReactivationStatus(user);

    const updatedUser = await db().user.update({
      where: { id: user.id },
      data: {
        status: nextStatus,
        sessionVersion: {
          increment: 1,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    return NextResponse.json(updatedUser);
  }

  if (user.status !== UserStatus.REJECTED) {
    return NextResponse.json({ error: "Somente cadastros rejeitados podem ser reabertos." }, { status: 409 });
  }

  const reopenedStatus = getRejectedReopenStatus(user);
  const updatedUser = await db().user.update({
    where: { id: user.id },
    data: {
      status: reopenedStatus,
      sessionVersion: {
        increment: 1,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  return NextResponse.json(updatedUser);
}
