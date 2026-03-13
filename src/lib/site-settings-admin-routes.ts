import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { type SiteAssetKind, validateSiteAssetFile } from "@/lib/site-asset";
import { deleteSiteAsset, updateSiteAsset } from "@/lib/site-settings";

export async function handleSiteAssetUpload(request: Request, kind: SiteAssetKind) {
  try {
    const adminCheck = await requireAdminApi();
    if (!adminCheck.ok) return adminCheck.response;

    const formData = await request.formData().catch(() => null);
    const fileLike = formData?.get("file");
    const validationError = validateSiteAssetFile(kind, fileLike);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const settings = await updateSiteAsset(kind, fileLike as File);
    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao enviar asset.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function handleSiteAssetDelete(kind: SiteAssetKind) {
  try {
    const adminCheck = await requireAdminApi();
    if (!adminCheck.ok) return adminCheck.response;

    const settings = await deleteSiteAsset(kind);
    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao remover asset.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
