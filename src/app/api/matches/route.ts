import { NextResponse } from "next/server";
import { listMatches } from "@/lib/match-service";

export async function GET(request: Request) {
  const matches = await listMatches(request);
  return NextResponse.json(matches);
}
