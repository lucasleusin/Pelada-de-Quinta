import { NextResponse } from "next/server";
import { requireActivePlayerApi } from "@/lib/auth-user";
import { setPresenceStatus } from "@/lib/match-service";
import { authenticatedPresenceSchema } from "@/lib/validators";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requireActivePlayerApi();
  if (!authCheck.ok) return authCheck.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = authenticatedPresenceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return setPresenceStatus(id, authCheck.user.playerId!, parsed.data.presenceStatus);
}

