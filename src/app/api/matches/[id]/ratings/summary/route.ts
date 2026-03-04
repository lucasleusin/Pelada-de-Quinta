import { NextResponse } from "next/server";
import { getRatingsSummary } from "@/lib/match-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const summary = await getRatingsSummary(id);
  return NextResponse.json(summary);
}
