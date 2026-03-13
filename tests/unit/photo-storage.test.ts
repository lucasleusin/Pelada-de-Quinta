import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildPublicPhotoUrl,
  getPhotoStorageDriver,
  normalizePhotoPath,
  readLocalPhoto,
} from "@/lib/photo-storage";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("photo storage helpers", () => {
  it("prefers explicit local driver when configured", () => {
    process.env.PHOTO_STORAGE_DRIVER = "local";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "secret";

    expect(getPhotoStorageDriver()).toBe("local");
  });

  it("falls back to supabase when legacy env vars are present", () => {
    delete process.env.PHOTO_STORAGE_DRIVER;
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "secret";

    expect(getPhotoStorageDriver()).toBe("supabase");
  });

  it("falls back to local when supabase env vars are absent", () => {
    delete process.env.PHOTO_STORAGE_DRIVER;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(getPhotoStorageDriver()).toBe("local");
  });

  it("builds a public local URL with a custom base path", () => {
    process.env.PHOTO_PUBLIC_BASE_PATH = "/arquivos";

    expect(buildPublicPhotoUrl("players/player-1/123.jpg")).toBe("/arquivos/players/player-1/123.jpg");
  });

  it("rejects path traversal attempts", () => {
    expect(() => normalizePhotoPath("../secret.txt")).toThrow("Caminho de foto invalido.");
    expect(() => normalizePhotoPath(["players", "..", "secret.txt"])).toThrow("Caminho de foto invalido.");
  });

  it("detects svg and ico content types from local storage", async () => {
    const storageDir = mkdtempSync(path.join(tmpdir(), "pelada-storage-"));
    process.env.PHOTO_STORAGE_DIR = storageDir;

    mkdirSync(path.join(storageDir, "site", "logo"), { recursive: true });
    mkdirSync(path.join(storageDir, "site", "favicon"), { recursive: true });
    writeFileSync(path.join(storageDir, "site", "logo", "brand.svg"), "<svg></svg>", { encoding: "utf8" });
    writeFileSync(path.join(storageDir, "site", "favicon", "brand.ico"), "ico", { encoding: "utf8" });

    try {
      const svg = await readLocalPhoto("site/logo/brand.svg");
      const ico = await readLocalPhoto("site/favicon/brand.ico");

      expect(svg.contentType).toBe("image/svg+xml");
      expect(ico.contentType).toBe("image/x-icon");
    } finally {
      rmSync(storageDir, { recursive: true, force: true });
    }
  });
});
