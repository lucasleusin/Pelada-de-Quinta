import { saveRatings } from "@/lib/match-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  return saveRatings(id, body);
}
