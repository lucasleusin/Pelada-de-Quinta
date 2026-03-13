import type { SiteSettings } from "@prisma/client";
import { getPrismaClient } from "@/lib/db";
import { deletePhoto, storePhoto } from "@/lib/photo-storage";
import { buildSiteAssetPath, type SiteAssetKind } from "@/lib/site-asset";
import {
  DEFAULT_SITE_SETTINGS,
  DEFAULT_SITE_SETTINGS_VALUES,
  type SiteSettingsPublic,
} from "@/lib/site-settings-contract";

type DbClient = ReturnType<typeof getPrismaClient>;

type SiteSettingsUpdateInput = Pick<
  SiteSettingsPublic,
  "siteName" | "siteShortName" | "siteDescription" | "locationLabel" | "headerBadge"
>;

const DEFAULT_SITE_SETTINGS_ID = "default";

function db() {
  return getPrismaClient();
}

function getVersionedAssetUrl(url: string | null, updatedAt: Date) {
  if (!url) {
    return null;
  }

  const [pathname, search = ""] = url.split("?");
  const params = new URLSearchParams(search);
  params.set("v", String(updatedAt.getTime()));

  return `${pathname}?${params.toString()}`;
}

function serializeSiteSettings(settings: SiteSettings): SiteSettingsPublic {
  return {
    id: settings.id,
    siteName: settings.siteName,
    siteShortName: settings.siteShortName,
    siteDescription: settings.siteDescription,
    locationLabel: settings.locationLabel,
    headerBadge: settings.headerBadge,
    logoUrl: getVersionedAssetUrl(settings.logoUrl, settings.updatedAt),
    faviconUrl: getVersionedAssetUrl(settings.faviconUrl, settings.updatedAt),
    shareImageUrl: getVersionedAssetUrl(settings.shareImageUrl, settings.updatedAt),
    updatedAt: settings.updatedAt.toISOString(),
  };
}

function getAssetPath(settings: SiteSettings, kind: SiteAssetKind) {
  if (kind === "logo") return settings.logoPath;
  if (kind === "favicon") return settings.faviconPath;
  return settings.shareImagePath;
}

function buildAssetUpdateData(kind: SiteAssetKind, photoPath: string | null, photoUrl: string | null) {
  if (kind === "logo") {
    return {
      logoPath: photoPath,
      logoUrl: photoUrl,
    };
  }

  if (kind === "favicon") {
    return {
      faviconPath: photoPath,
      faviconUrl: photoUrl,
    };
  }

  return {
    shareImagePath: photoPath,
    shareImageUrl: photoUrl,
  };
}

export async function ensureSiteSettings(prisma: DbClient = db()) {
  return prisma.siteSettings.upsert({
    where: { id: DEFAULT_SITE_SETTINGS_ID },
    update: {},
    create: {
      id: DEFAULT_SITE_SETTINGS_ID,
      ...DEFAULT_SITE_SETTINGS_VALUES,
    },
  });
}

export async function getSiteSettingsRecord(prisma: DbClient = db()) {
  return ensureSiteSettings(prisma);
}

export async function getSiteSettings(prisma: DbClient = db()) {
  const settings = await ensureSiteSettings(prisma);
  return serializeSiteSettings(settings);
}

export async function updateSiteSettings(input: SiteSettingsUpdateInput, prisma: DbClient = db()) {
  await ensureSiteSettings(prisma);

  const updated = await prisma.siteSettings.update({
    where: { id: DEFAULT_SITE_SETTINGS_ID },
    data: {
      siteName: input.siteName,
      siteShortName: input.siteShortName,
      siteDescription: input.siteDescription,
      locationLabel: input.locationLabel,
      headerBadge: input.headerBadge,
    },
  });

  return serializeSiteSettings(updated);
}

export async function updateSiteAsset(kind: SiteAssetKind, file: File, prisma: DbClient = db()) {
  const settings = await ensureSiteSettings(prisma);
  const photoPath = buildSiteAssetPath(kind, file.type);
  const stored = await storePhoto({
    photoPath,
    data: Buffer.from(await file.arrayBuffer()),
    contentType: file.type,
  });

  const previousPath = getAssetPath(settings, kind);
  if (previousPath && previousPath !== stored.photoPath) {
    await deletePhoto(previousPath);
  }

  const updated = await prisma.siteSettings.update({
    where: { id: settings.id },
    data: buildAssetUpdateData(kind, stored.photoPath, stored.photoUrl),
  });

  return serializeSiteSettings(updated);
}

export async function deleteSiteAsset(kind: SiteAssetKind, prisma: DbClient = db()) {
  const settings = await ensureSiteSettings(prisma);
  const previousPath = getAssetPath(settings, kind);

  if (previousPath) {
    await deletePhoto(previousPath);
  }

  const updated = await prisma.siteSettings.update({
    where: { id: settings.id },
    data: buildAssetUpdateData(kind, null, null),
  });

  return serializeSiteSettings(updated);
}

export async function getCachedSiteSettings() {
  try {
    return await getSiteSettings();
  } catch (error) {
    console.error("Falha ao carregar configuracao publica do site.", error);
    return DEFAULT_SITE_SETTINGS;
  }
}
