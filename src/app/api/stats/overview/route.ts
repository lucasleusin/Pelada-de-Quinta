import { NextResponse } from "next/server";
import { getGeneralStatsOverview } from "@/lib/match-service";

export async function GET() {
  const overview = await getGeneralStatsOverview();
  return NextResponse.json(overview);
}
