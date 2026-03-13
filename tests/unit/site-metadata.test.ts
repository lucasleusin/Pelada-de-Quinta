import { describe, expect, it } from "vitest";
import { buildSiteMetadata } from "@/lib/site-metadata";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings-contract";

describe("site metadata", () => {
  it("builds metadata with versioned favicon and share image", () => {
    const metadata = buildSiteMetadata(
      {
        ...DEFAULT_SITE_SETTINGS,
        siteName: "Lo Sports FC",
        siteDescription: "Liga semanal com dados e confirmacoes.",
        faviconUrl: "/uploads/site/favicon/brand.ico?v=123",
        shareImageUrl: "/uploads/site/share-image/brand.png?v=456",
      },
      "https://pelada.losportsconsulting.com",
    );

    expect(metadata.title).toBe("Lo Sports FC");
    expect(metadata.applicationName).toBe("Lo Sports FC");
    expect(metadata.icons).toEqual({
      icon: "/uploads/site/favicon/brand.ico?v=123",
      shortcut: "/uploads/site/favicon/brand.ico?v=123",
      apple: "/uploads/site/favicon/brand.ico?v=123",
    });
    expect(metadata.openGraph?.images).toEqual(["/uploads/site/share-image/brand.png?v=456"]);
    expect((metadata.twitter as { card?: string } | undefined)?.card).toBe("summary_large_image");
  });
});
