import { NextResponse } from "next/server";
import { setPresenceStatus } from "@/lib/match-service";
import { publicPresenceSchema } from "@/lib/validators";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = publicPresenceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return setPresenceStatus(id, parsed.data.playerId, parsed.data.presenceStatus);
}
