import { updateMatchScore } from "@/lib/match-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  return updateMatchScore(id, body, false);
}
