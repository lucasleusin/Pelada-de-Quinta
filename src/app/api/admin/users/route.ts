import { UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth-user";
import { getPrismaClient } from "@/lib/db";

const db = () => getPrismaClient();

export async function GET() {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const [users, players] = await Promise.all([
    db().user.findMany({
      where: {
        mergedIntoUserId: null,
      },
      orderBy: [{ createdAt: "asc" }],
      include: {
        player: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
      },
    }),
    db().player.findMany({
      where: {
        isActive: true,
        mergedIntoPlayerId: null,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        nickname: true,
      },
    }),
  ]);

  return NextResponse.json({
    pendingUsers: users.filter((user) =>
      user.status === UserStatus.PENDING_VERIFICATION || user.status === UserStatus.PENDING_APPROVAL,
    ),
    activeUsers: users.filter((user) => user.status === UserStatus.ACTIVE),
    removedUsers: users.filter((user) => user.status === UserStatus.DISABLED || user.status === UserStatus.REJECTED),
    players,
  });
}
