import { NextResponse } from "next/server";
import { createMatch, listMatches, requireAdminOr401 } from "@/lib/match-service";

export async function GET(request: Request) {
  const guard = await requireAdminOr401();
  if (!guard.ok) return guard.response;

  const matches = await listMatches(request);
  return NextResponse.json(matches);
}

export async function POST(request: Request) {
  const guard = await requireAdminOr401();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  return createMatch(body);
}
