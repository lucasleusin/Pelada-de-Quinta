import { getCurrentUser } from "@/lib/auth-user";
import { saveStats } from "@/lib/match-service";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const currentUser = await getCurrentUser();
  return saveStats(id, body, false, currentUser);
}
