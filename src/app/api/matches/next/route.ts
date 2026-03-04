import { NextResponse } from "next/server";
import { getNextMatch } from "@/lib/match-service";

export async function GET() {
  const match = await getNextMatch();

  if (!match) {
    return NextResponse.json({ match: null });
  }

  return NextResponse.json({ match });
}
