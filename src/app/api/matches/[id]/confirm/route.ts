import { NextResponse } from "next/server";
import { confirmPresence } from "@/lib/match-service";
import { confirmPresenceSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = confirmPresenceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return confirmPresence(id, parsed.data.playerId);
}
