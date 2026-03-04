import { NextResponse } from "next/server";
import { getLeaderboards, requireAdminOr401 } from "@/lib/match-service";

export async function GET() {
  const guard = await requireAdminOr401();
  if (!guard.ok) return guard.response;

  const data = await getLeaderboards();
  return NextResponse.json(data);
}
