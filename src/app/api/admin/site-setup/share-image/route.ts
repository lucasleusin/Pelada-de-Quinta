import { handleSiteAssetDelete, handleSiteAssetUpload } from "@/lib/site-settings-admin-routes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleSiteAssetUpload(request, "shareImage");
}

export async function DELETE() {
  return handleSiteAssetDelete("shareImage");
}
