import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin";
import { playerCreateSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await request.json().catch(() => null);
  const parsed = playerCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const prisma = getPrismaClient();
  const player = await prisma.player.create({
    data: {
      name: parsed.data.name,
      position: parsed.data.position,
      shirtNumberPreference: parsed.data.shirtNumberPreference ?? null,
      isActive: parsed.data.isActive ?? true,
    },
  });

  return NextResponse.json(player, { status: 201 });
}
