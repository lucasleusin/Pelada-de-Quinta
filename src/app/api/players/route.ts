import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/db";

export async function GET(request: Request) {
  const prisma = getPrismaClient();
  const { searchParams } = new URL(request.url);
  const active = searchParams.get("active");
  const publicSelectable = searchParams.get("publicSelectable") === "true";

  const players = await prisma.player.findMany({
    where:
      active === null
        ? {
            mergedIntoPlayerId: null,
            user: publicSelectable ? { is: null } : undefined,
          }
        : {
            isActive: active === "true",
            mergedIntoPlayerId: null,
            user: publicSelectable ? { is: null } : undefined,
          },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(players);
}
