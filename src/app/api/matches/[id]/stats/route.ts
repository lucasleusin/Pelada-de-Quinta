import { saveStats } from "@/lib/match-service";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  return saveStats(id, body, false);
}
