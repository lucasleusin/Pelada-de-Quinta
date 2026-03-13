import type { Metadata } from "next";
import type { SiteSettingsPublic } from "@/lib/site-settings-contract";

function getMetadataBase(appBaseUrl = process.env.APP_BASE_URL?.trim()) {
  if (!appBaseUrl) {
    return undefined;
  }

  try {
    return new URL(appBaseUrl);
  } catch {
    return undefined;
  }
}

export function buildSiteMetadata(
  settings: SiteSettingsPublic,
  appBaseUrl = process.env.APP_BASE_URL?.trim(),
): Metadata {
  const shareImages = settings.shareImageUrl ? [settings.shareImageUrl] : undefined;
  const faviconHref = `/favicon.ico?v=${encodeURIComponent(settings.updatedAt)}`;

  return {
    metadataBase: getMetadataBase(appBaseUrl),
    title: settings.siteName,
    description: settings.siteDescription || undefined,
    applicationName: settings.siteName,
    icons: {
      icon: faviconHref,
      shortcut: faviconHref,
      apple: faviconHref,
    },
    openGraph: {
      type: "website",
      title: settings.siteName,
      description: settings.siteDescription || undefined,
      siteName: settings.siteName,
      images: shareImages,
    },
    twitter: {
      card: settings.shareImageUrl ? "summary_large_image" : "summary",
      title: settings.siteName,
      description: settings.siteDescription || undefined,
      images: shareImages,
    },
  };
}
