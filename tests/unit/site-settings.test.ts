import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prismaMock: {
    siteSettings: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
  storePhoto: vi.fn(),
  deletePhoto: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getPrismaClient: () => mocks.prismaMock,
}));

vi.mock("@/lib/photo-storage", () => ({
  storePhoto: mocks.storePhoto,
  deletePhoto: mocks.deletePhoto,
}));

import { deleteSiteAsset, getSiteSettings, updateSiteAsset, updateSiteSettings } from "@/lib/site-settings";

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "default",
    siteName: "Pelada da Quinta",
    siteShortName: "CH-RS - Pelada",
    siteDescription: "Gestao da pelada semanal de Cachoeira do Sul",
    locationLabel: "Cachoeira do Sul",
    headerBadge: "Gestao Semanal",
    logoUrl: null,
    logoPath: null,
    faviconUrl: null,
    faviconPath: null,
    shareImageUrl: null,
    shareImagePath: null,
    createdAt: new Date("2026-03-13T12:00:00.000Z"),
    updatedAt: new Date("2026-03-13T12:00:00.000Z"),
    ...overrides,
  };
}

describe("site settings service", () => {
  beforeEach(() => {
    mocks.prismaMock.siteSettings.upsert.mockReset();
    mocks.prismaMock.siteSettings.update.mockReset();
    mocks.storePhoto.mockReset();
    mocks.deletePhoto.mockReset();
  });

  it("returns serialized defaults through ensure/upsert", async () => {
    mocks.prismaMock.siteSettings.upsert.mockResolvedValue(makeRecord());

    const result = await getSiteSettings();

    expect(result.siteName).toBe("Pelada da Quinta");
    expect(result.siteShortName).toBe("CH-RS - Pelada");
    expect(result.logoUrl).toBeNull();
  });

  it("updates textual branding fields", async () => {
    mocks.prismaMock.siteSettings.upsert.mockResolvedValue(makeRecord());
    mocks.prismaMock.siteSettings.update.mockResolvedValue(
      makeRecord({
        siteName: "Lo Sports FC",
        siteShortName: "Lo Sports",
        siteDescription: "Liga semanal com estatisticas.",
        locationLabel: "Porto Alegre",
        headerBadge: "Temporada 2026",
      }),
    );

    const result = await updateSiteSettings({
      siteName: "Lo Sports FC",
      siteShortName: "Lo Sports",
      siteDescription: "Liga semanal com estatisticas.",
      locationLabel: "Porto Alegre",
      headerBadge: "Temporada 2026",
    });

    expect(mocks.prismaMock.siteSettings.update).toHaveBeenCalledWith({
      where: { id: "default" },
      data: {
        siteName: "Lo Sports FC",
        siteShortName: "Lo Sports",
        siteDescription: "Liga semanal com estatisticas.",
        locationLabel: "Porto Alegre",
        headerBadge: "Temporada 2026",
      },
    });
    expect(result.siteName).toBe("Lo Sports FC");
  });

  it("replaces an existing asset and removes the old file", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1773400000000);
    mocks.prismaMock.siteSettings.upsert.mockResolvedValue(
      makeRecord({
        logoPath: "site/logo/old.png",
        logoUrl: "/uploads/site/logo/old.png",
      }),
    );
    mocks.storePhoto.mockResolvedValue({
      photoPath: "site/logo/1773400000000.png",
      photoUrl: "/uploads/site/logo/1773400000000.png",
    });
    mocks.prismaMock.siteSettings.update.mockResolvedValue(
      makeRecord({
        logoPath: "site/logo/1773400000000.png",
        logoUrl: "/uploads/site/logo/1773400000000.png",
        updatedAt: new Date("2026-03-13T12:30:00.000Z"),
      }),
    );

    const file = new File([Buffer.from("logo")], "logo.png", { type: "image/png" });
    const result = await updateSiteAsset("logo", file);

    expect(mocks.storePhoto).toHaveBeenCalledWith({
      photoPath: "site/logo/1773400000000.png",
      data: Buffer.from("logo"),
      contentType: "image/png",
    });
    expect(mocks.deletePhoto).toHaveBeenCalledWith("site/logo/old.png");
    expect(result.logoUrl).toContain("/uploads/site/logo/1773400000000.png");
    vi.restoreAllMocks();
  });

  it("removes an asset and clears its persisted fields", async () => {
    mocks.prismaMock.siteSettings.upsert.mockResolvedValue(
      makeRecord({
        faviconPath: "site/favicon/brand.ico",
        faviconUrl: "/uploads/site/favicon/brand.ico",
      }),
    );
    mocks.prismaMock.siteSettings.update.mockResolvedValue(
      makeRecord({
        faviconPath: null,
        faviconUrl: null,
      }),
    );

    const result = await deleteSiteAsset("favicon");

    expect(mocks.deletePhoto).toHaveBeenCalledWith("site/favicon/brand.ico");
    expect(mocks.prismaMock.siteSettings.update).toHaveBeenCalledWith({
      where: { id: "default" },
      data: {
        faviconPath: null,
        faviconUrl: null,
      },
    });
    expect(result.faviconUrl).toBeNull();
  });
});
