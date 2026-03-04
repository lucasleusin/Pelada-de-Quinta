import { NextResponse } from "next/server";
import { getPlayerReport, requireAdminOr401 } from "@/lib/match-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminOr401();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const report = await getPlayerReport(id);

  if (!report) {
    return NextResponse.json({ error: "Jogador nao encontrado." }, { status: 404 });
  }

  return NextResponse.json(report);
}
