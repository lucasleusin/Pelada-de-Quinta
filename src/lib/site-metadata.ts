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
    manifest: "/manifest.webmanifest",
    alternates: {
      languages: {
        "pt-BR": "/",
      },
    },
    icons: {
      icon: [
        { url: faviconHref },
        { url: "/pwa/icon-192", sizes: "192x192", type: "image/png" },
        { url: "/pwa/icon-512", sizes: "512x512", type: "image/png" },
      ],
      shortcut: faviconHref,
      apple: [{ url: faviconHref }],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: settings.siteShortName || settings.siteName,
    },
    openGraph: {
      type: "website",
      title: settings.siteName,
      description: settings.siteDescription || undefined,
      siteName: settings.siteName,
      locale: "pt_BR",
      images: shareImages,
    },
    twitter: {
      card: settings.shareImageUrl ? "summary_large_image" : "summary",
      title: settings.siteName,
      description: settings.siteDescription || undefined,
      images: shareImages,
    },
    other: {
      language: "pt-BR",
      "content-language": "pt-BR",
      google: "notranslate",
    },
  };
}
