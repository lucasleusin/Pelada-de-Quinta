export type SiteAssetKind = "logo" | "favicon" | "shareImage";

const MAX_SITE_ASSET_SIZE_BYTES = 5 * 1024 * 1024;

const SITE_ASSET_MIME_TYPES: Record<SiteAssetKind, Set<string>> = {
  logo: new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]),
  favicon: new Set(["image/png", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"]),
  shareImage: new Set(["image/jpeg", "image/png", "image/webp"]),
};

export function getSiteAssetRouteSegment(kind: SiteAssetKind) {
  if (kind === "shareImage") return "share-image";
  return kind;
}

function getSiteAssetExtension(kind: SiteAssetKind, mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/svg+xml" && (kind === "logo" || kind === "favicon")) return "svg";
  if ((mimeType === "image/x-icon" || mimeType === "image/vnd.microsoft.icon") && kind === "favicon") return "ico";
  return null;
}

function getAcceptedFormatsMessage(kind: SiteAssetKind) {
  if (kind === "logo") return "Formato invalido. Envie JPG, PNG, WEBP ou SVG.";
  if (kind === "favicon") return "Formato invalido. Envie PNG, SVG ou ICO.";
  return "Formato invalido. Envie JPG, PNG ou WEBP.";
}

export function getSiteAssetAccept(kind: SiteAssetKind) {
  if (kind === "logo") return "image/png,image/jpeg,image/webp,image/svg+xml";
  if (kind === "favicon") return "image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,.ico";
  return "image/png,image/jpeg,image/webp";
}

export function buildSiteAssetPath(kind: SiteAssetKind, mimeType: string, timestamp = Date.now()) {
  const extension = getSiteAssetExtension(kind, mimeType);

  if (!extension) {
    throw new Error(getAcceptedFormatsMessage(kind));
  }

  return `site/${getSiteAssetRouteSegment(kind)}/${timestamp}.${extension}`;
}

export function validateSiteAssetFile(kind: SiteAssetKind, fileLike: FormDataEntryValue | null | undefined) {
  if (!(fileLike instanceof File)) {
    return "Arquivo invalido.";
  }

  if (!SITE_ASSET_MIME_TYPES[kind].has(fileLike.type)) {
    return getAcceptedFormatsMessage(kind);
  }

  if (fileLike.size > MAX_SITE_ASSET_SIZE_BYTES) {
    return "Arquivo muito grande. Limite de 5MB.";
  }

  return null;
}
