import { requireAdminOr401, updateTeams } from "@/lib/match-service";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminOr401();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  return updateTeams(id, body);
}
