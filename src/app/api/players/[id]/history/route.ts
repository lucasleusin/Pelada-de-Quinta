import { NextResponse } from "next/server";
import { getCurrentUser, resolveCurrentPlayerId } from "@/lib/auth-user";
import { getPlayerReport } from "@/lib/match-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  const adminOverride =
    id !== "me" &&
    currentUser?.role === "ADMIN" &&
    currentUser.status === "ACTIVE" &&
    !currentUser.mustChangePassword;

  const resolved = adminOverride ? id : await resolveCurrentPlayerId(id);

  if (typeof resolved !== "string") {
    return resolved.response;
  }

  const report = await getPlayerReport(resolved);

  if (!report) {
    return NextResponse.json({ error: "Jogador nao encontrado." }, { status: 404 });
  }

  return NextResponse.json(report);
}
