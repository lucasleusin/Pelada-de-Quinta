import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { listWhatsAppMessageLogs } from "@/lib/whatsapp-service";

export async function GET(request: Request) {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? "30");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 30;
  const notifications = await listWhatsAppMessageLogs(limit);

  return NextResponse.json(notifications);
}

