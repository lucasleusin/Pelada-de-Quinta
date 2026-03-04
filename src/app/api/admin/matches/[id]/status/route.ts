import { requireAdminOr401, updateMatchStatus } from "@/lib/match-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminOr401();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  return updateMatchStatus(id, body);
}
