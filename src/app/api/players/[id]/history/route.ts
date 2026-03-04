import { NextResponse } from "next/server";
import { getPlayerReport } from "@/lib/match-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getPlayerReport(id);

  if (!report) {
    return NextResponse.json({ error: "Jogador nao encontrado." }, { status: 404 });
  }

  return NextResponse.json(report);
}
