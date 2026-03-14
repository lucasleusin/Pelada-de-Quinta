import { Position } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth-user";
import { getPrismaClient } from "@/lib/db";
import { buildPlayerPatchFromUserSnapshot } from "@/lib/user-management";
import { approveRegistrationSchema } from "@/lib/validators";

const db = () => getPrismaClient();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = approveRegistrationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await db().user.findUnique({ where: { id } });

  if (!user) {
    return NextResponse.json({ error: "Cadastro nao encontrado." }, { status: 404 });
  }

  if (parsed.data.action === "reject") {
    await db().user.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "create") {
    const player = await db().player.create({
      data: {
        name: user.name ?? user.email,
        nickname: user.nickname ?? null,
        position: user.position ?? Position.OUTRO,
        shirtNumberPreference: user.shirtNumberPreference ?? null,
        email: user.email,
        phone: user.whatsApp ?? null,
        isActive: true,
      },
    });

    await db().user.update({
      where: { id },
      data: {
        playerId: player.id,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ ok: true, playerId: player.id });
  }

  const player = await db().player.findUnique({ where: { id: parsed.data.playerId! } });

  if (!player) {
    return NextResponse.json({ error: "Jogador nao encontrado." }, { status: 404 });
  }

  const existingUser = await db().user.findFirst({
    where: {
      playerId: player.id,
      id: { not: id },
    },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json({ error: "Este jogador ja esta vinculado a outra conta." }, { status: 409 });
  }

    await db().$transaction(async (tx) => {
      await tx.player.update({
        where: { id: player.id },
        data: buildPlayerPatchFromUserSnapshot(user),
      });

    await tx.user.update({
      where: { id },
      data: {
        playerId: player.id,
        status: "ACTIVE",
      },
    });
  });

  return NextResponse.json({ ok: true, playerId: player.id });
}
