import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/db";

export async function GET(request: Request) {
  const prisma = getPrismaClient();
  const { searchParams } = new URL(request.url);
  const active = searchParams.get("active");

  const players = await prisma.player.findMany({
    where:
      active === null
        ? {
            mergedIntoPlayerId: null,
          }
        : {
            isActive: active === "true",
            mergedIntoPlayerId: null,
          },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(players);
}
