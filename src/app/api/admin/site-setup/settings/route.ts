import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { getSiteSettings, updateSiteSettings } from "@/lib/site-settings";
import { siteSettingsUpdateSchema } from "@/lib/validators";

export async function GET() {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const settings = await getSiteSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await request.json().catch(() => null);
  const parsed = siteSettingsUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await updateSiteSettings(parsed.data);
  return NextResponse.json(settings);
}
