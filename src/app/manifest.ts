import type { MetadataRoute } from "next";
import { getCachedSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getCachedSiteSettings();
  const icons: NonNullable<MetadataRoute.Manifest["icons"]> = settings.faviconUrl
    ? [
        {
          src: `/favicon.ico?v=${encodeURIComponent(settings.updatedAt)}`,
        },
      ]
    : [
        {
          src: "/pwa/icon-192",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/pwa/icon-512",
          sizes: "512x512",
          type: "image/png",
        },
        {
          src: "/pwa/icon-512",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable" as const,
        },
      ];

  return {
    id: "/",
    name: settings.siteName,
    short_name: settings.siteShortName || settings.siteName,
    description: settings.siteDescription || "Gestao da pelada semanal de Cachoeira do Sul.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5faf8",
    theme_color: "#0e6b3d",
    categories: ["sports", "productivity"],
    lang: "pt-BR",
    icons,
  };
}
