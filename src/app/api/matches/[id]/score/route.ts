import { getCurrentUser } from "@/lib/auth-user";
import { updateMatchScore } from "@/lib/match-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const currentUser = await getCurrentUser();
  return updateMatchScore(id, body, false, currentUser);
}
