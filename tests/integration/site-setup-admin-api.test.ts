import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminApi: vi.fn(),
  getSiteSettings: vi.fn(),
  updateSiteSettings: vi.fn(),
  updateSiteAsset: vi.fn(),
  deleteSiteAsset: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  requireAdminApi: mocks.requireAdminApi,
}));

vi.mock("@/lib/site-settings", () => ({
  getSiteSettings: mocks.getSiteSettings,
  updateSiteSettings: mocks.updateSiteSettings,
  updateSiteAsset: mocks.updateSiteAsset,
  deleteSiteAsset: mocks.deleteSiteAsset,
}));

import { GET as getSettings, PUT as putSettings } from "@/app/api/admin/site-setup/settings/route";
import { POST as postLogo, DELETE as deleteLogo } from "@/app/api/admin/site-setup/logo/route";
import { POST as postFavicon } from "@/app/api/admin/site-setup/favicon/route";
import { POST as postShareImage } from "@/app/api/admin/site-setup/share-image/route";

function makeSettings() {
  return {
    id: "default",
    siteName: "Pelada da Quinta",
    siteShortName: "CH-RS - Pelada",
    siteDescription: "Gestao da pelada semanal de Cachoeira do Sul",
    locationLabel: "Cachoeira do Sul",
    headerBadge: "Gestao Semanal",
    logoUrl: null,
    faviconUrl: null,
    shareImageUrl: null,
    updatedAt: new Date().toISOString(),
  };
}

describe("site setup admin api", () => {
  beforeEach(() => {
    mocks.requireAdminApi.mockReset();
    mocks.getSiteSettings.mockReset();
    mocks.updateSiteSettings.mockReset();
    mocks.updateSiteAsset.mockReset();
    mocks.deleteSiteAsset.mockReset();
    mocks.requireAdminApi.mockResolvedValue({ ok: true, admin: { id: "admin-1" } });
  });

  it("returns serialized site settings", async () => {
    mocks.getSiteSettings.mockResolvedValue(makeSettings());

    const response = await getSettings();
    const payload = (await response.json()) as { siteName: string };

    expect(response.status).toBe(200);
    expect(payload.siteName).toBe("Pelada da Quinta");
  });

  it("updates site settings fields", async () => {
    mocks.updateSiteSettings.mockResolvedValue(makeSettings());

    const response = await putSettings(
      new Request("http://localhost/api/admin/site-setup/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          siteName: "Lo Sports FC",
          siteShortName: "Lo Sports",
          siteDescription: "Liga semanal com estatisticas.",
          locationLabel: "Porto Alegre",
          headerBadge: "Temporada 2026",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateSiteSettings).toHaveBeenCalledWith({
      siteName: "Lo Sports FC",
      siteShortName: "Lo Sports",
      siteDescription: "Liga semanal com estatisticas.",
      locationLabel: "Porto Alegre",
      headerBadge: "Temporada 2026",
    });
  });

  it("uploads the logo asset", async () => {
    mocks.updateSiteAsset.mockResolvedValue(makeSettings());
    const formData = new FormData();
    formData.append("file", new File([Buffer.from("logo")], "logo.png", { type: "image/png" }));

    const response = await postLogo(
      new Request("http://localhost/api/admin/site-setup/logo", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateSiteAsset).toHaveBeenCalledWith("logo", expect.any(File));
  });

  it("uploads the favicon asset", async () => {
    mocks.updateSiteAsset.mockResolvedValue(makeSettings());
    const formData = new FormData();
    formData.append("file", new File([Buffer.from("ico")], "favicon.ico", { type: "image/x-icon" }));

    const response = await postFavicon(
      new Request("http://localhost/api/admin/site-setup/favicon", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateSiteAsset).toHaveBeenCalledWith("favicon", expect.any(File));
  });

  it("uploads the share image asset", async () => {
    mocks.updateSiteAsset.mockResolvedValue(makeSettings());
    const formData = new FormData();
    formData.append("file", new File([Buffer.from("cover")], "cover.png", { type: "image/png" }));

    const response = await postShareImage(
      new Request("http://localhost/api/admin/site-setup/share-image", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateSiteAsset).toHaveBeenCalledWith("shareImage", expect.any(File));
  });

  it("removes the logo asset", async () => {
    mocks.deleteSiteAsset.mockResolvedValue(makeSettings());

    const response = await deleteLogo();

    expect(response.status).toBe(200);
    expect(mocks.deleteSiteAsset).toHaveBeenCalledWith("logo");
  });
});
