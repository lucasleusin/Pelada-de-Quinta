import { beforeEach, describe, expect, it, vi } from "vitest";
import * as photoStorage from "@/lib/photo-storage";
import { GET } from "@/app/uploads/[...path]/route";

vi.mock("@/lib/photo-storage", () => ({
  getPhotoStorageDriver: vi.fn(),
  normalizePhotoPath: vi.fn(),
  readLocalPhoto: vi.fn(),
}));

describe("uploads route", () => {
  beforeEach(() => {
    vi.mocked(photoStorage.getPhotoStorageDriver).mockReset();
    vi.mocked(photoStorage.normalizePhotoPath).mockReset();
    vi.mocked(photoStorage.readLocalPhoto).mockReset();
  });

  it("returns 404 when local storage is not active", async () => {
    vi.mocked(photoStorage.getPhotoStorageDriver).mockReturnValue("supabase");

    const response = await GET(new Request("http://localhost/uploads/test.jpg"), {
      params: Promise.resolve({ path: ["players", "player-1", "test.jpg"] }),
    });

    expect(response.status).toBe(404);
  });

  it("returns a local file when the driver is local", async () => {
    vi.mocked(photoStorage.getPhotoStorageDriver).mockReturnValue("local");
    vi.mocked(photoStorage.normalizePhotoPath).mockReturnValue("players/player-1/test.jpg");
    vi.mocked(photoStorage.readLocalPhoto).mockResolvedValue({
      data: Buffer.from("image-bytes"),
      contentType: "image/jpeg",
    });

    const response = await GET(new Request("http://localhost/uploads/test.jpg"), {
      params: Promise.resolve({ path: ["players", "player-1", "test.jpg"] }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("image-bytes");
  });
});
