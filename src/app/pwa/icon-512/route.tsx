import { buildPwaIconResponse } from "@/lib/pwa-icon";

export const dynamic = "force-dynamic";

export async function GET() {
  return buildPwaIconResponse(512);
}
