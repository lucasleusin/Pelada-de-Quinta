import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/admin/users/merge/route";

const { requireAdminApi, listMergeCandidates, previewEntityMerge, executeEntityMerge } = vi.hoisted(() => ({
  requireAdminApi: vi.fn(),
  listMergeCandidates: vi.fn(),
  previewEntityMerge: vi.fn(),
  executeEntityMerge: vi.fn(),
}));

const prismaMock = {};

vi.mock("@/lib/db", () => ({
  getPrismaClient: () => prismaMock,
}));

vi.mock("@/lib/auth-user", () => ({
  requireAdminApi,
}));

vi.mock("@/lib/user-merge", () => ({
  MergeValidationError: class MergeValidationError extends Error {
    status: number;
    constructor(message: string, status = 409) {
      super(message);
      this.status = status;
    }
  },
  listMergeCandidates,
  previewEntityMerge,
  executeEntityMerge,
}));

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/admin/users/merge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin user merge api", () => {
  beforeEach(() => {
    requireAdminApi.mockReset();
    listMergeCandidates.mockReset();
    previewEntityMerge.mockReset();
    executeEntityMerge.mockReset();

    requireAdminApi.mockResolvedValue({
      ok: true,
      user: {
        id: "admin-1",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
  });

  it("lists merge candidates", async () => {
    listMergeCandidates.mockResolvedValue({
      users: [{ id: "user-1" }],
      players: [{ id: "player-1" }],
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(listMergeCandidates).toHaveBeenCalledWith(prismaMock);
  });

  it("returns a preview summary", async () => {
    previewEntityMerge.mockResolvedValue({
      userMerge: null,
      playerMerge: null,
      warnings: ["warn"],
    });

    const response = await POST(
      makeRequest({
        action: "preview",
        primaryUserId: "user-1",
        secondaryUserId: "user-2",
        primaryPlayerId: null,
        secondaryPlayerId: null,
      }),
    );

    expect(response.status).toBe(200);
    expect(previewEntityMerge).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        action: "preview",
        primaryUserId: "user-1",
        secondaryUserId: "user-2",
      }),
    );
  });

  it("executes the merge with the authenticated admin id", async () => {
    executeEntityMerge.mockResolvedValue({ ok: true });

    const response = await POST(
      makeRequest({
        action: "execute",
        primaryUserId: "user-1",
        secondaryUserId: "user-2",
        primaryPlayerId: "player-1",
        secondaryPlayerId: "player-2",
      }),
    );

    expect(response.status).toBe(200);
    expect(executeEntityMerge).toHaveBeenCalledWith(
      prismaMock,
      "admin-1",
      expect.objectContaining({
        action: "execute",
      }),
    );
  });
});
