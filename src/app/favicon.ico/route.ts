import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const settings = await getSiteSettings();
  const targetUrl = settings.faviconUrl
    ? new URL(settings.faviconUrl, request.url)
    : new URL("/default-favicon.ico", request.url);

  const response = NextResponse.redirect(targetUrl);
  response.headers.set("cache-control", "no-store, max-age=0, must-revalidate");

  return response;
}
