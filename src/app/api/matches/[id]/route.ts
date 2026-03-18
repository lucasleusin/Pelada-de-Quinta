import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-user";
import { getMatchById } from "@/lib/match-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  const match = await getMatchById(id, currentUser);

  if (!match) {
    return NextResponse.json({ error: "Partida nao encontrada." }, { status: 404 });
  }

  return NextResponse.json(match);
}
