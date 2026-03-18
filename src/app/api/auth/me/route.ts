import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-user";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    playerId: user.playerId,
    nickname: user.nickname,
    playerName: user.player?.name ?? null,
    playerNickname: user.player?.nickname ?? null,
    mustChangePassword: user.mustChangePassword,
    emailVerified: user.emailVerified,
  });
}
