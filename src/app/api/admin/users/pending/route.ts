import { NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { requireAdminApi } from "@/lib/auth-user";
import { getPrismaClient } from "@/lib/db";

const db = () => getPrismaClient();

export async function GET() {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const users = await db().user.findMany({
    where: {
      role: "PLAYER",
      status: {
        in: [UserStatus.PENDING_APPROVAL, UserStatus.PENDING_VERIFICATION],
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(users);
}
