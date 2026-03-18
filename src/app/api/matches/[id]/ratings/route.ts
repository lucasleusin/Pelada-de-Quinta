import { getCurrentUser } from "@/lib/auth-user";
import { saveRatings } from "@/lib/match-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const currentUser = await getCurrentUser();

  return saveRatings(
    id,
    body,
    currentUser?.status === "ACTIVE" && currentUser.playerId ? currentUser.playerId : null,
    currentUser,
    currentUser?.role === "ADMIN" && currentUser.status === "ACTIVE",
  );
}
