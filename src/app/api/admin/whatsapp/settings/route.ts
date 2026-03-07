import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { getWhatsAppSettings, updateWhatsAppSettings } from "@/lib/whatsapp-service";
import { whatsAppSettingsUpdateSchema } from "@/lib/validators";

function serializeSettings(settings: Awaited<ReturnType<typeof getWhatsAppSettings>>) {
  return settings;
}

export async function GET() {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const settings = await getWhatsAppSettings();
  return NextResponse.json(serializeSettings(settings));
}

export async function PUT(request: Request) {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await request.json().catch(() => null);
  const parsed = whatsAppSettingsUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await updateWhatsAppSettings(parsed.data);
  const settings = await getWhatsAppSettings();
  return NextResponse.json(serializeSettings(settings));
}
