import { requireAdminOr401, updateParticipantPresence } from "@/lib/match-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; playerId: string }> },
) {
  const guard = await requireAdminOr401();
  if (!guard.ok) return guard.response;

  const { id, playerId } = await params;
  const body = await request.json().catch(() => null);
  return updateParticipantPresence(id, playerId, body);
}
