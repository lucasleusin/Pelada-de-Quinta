import { NextResponse } from "next/server";
import { requireActivePlayerApi } from "@/lib/auth-user";
import { listMatches } from "@/lib/match-service";

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (url.searchParams.get("playerId") === "me") {
    const authCheck = await requireActivePlayerApi();
    if (!authCheck.ok) return authCheck.response;
    url.searchParams.set("playerId", authCheck.user.playerId!);
    if (url.searchParams.get("from") && !url.searchParams.get("to")) {
      url.searchParams.set("playerScope", "self-upcoming");
    }
  }

  const matches = await listMatches(new Request(url.toString(), { method: request.method, headers: request.headers }));
  return NextResponse.json(matches);
}
