import { exportLeaderboardCsv, requireAdminOr401 } from "@/lib/match-service";

export async function GET() {
  const guard = await requireAdminOr401();
  if (!guard.ok) return guard.response;

  const csv = await exportLeaderboardCsv();

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="relatorio-pelada.csv"',
    },
  });
}
