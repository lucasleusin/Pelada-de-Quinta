import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as resetPassword } from "@/app/api/admin/users/[id]/password-reset/route";
import { PATCH as updateRole } from "@/app/api/admin/users/[id]/role/route";
import { PATCH as updateStatus } from "@/app/api/admin/users/[id]/status/route";

const { requireAdminApi, createUserActionToken, sendPasswordResetEmail, hash } = vi.hoisted(() => ({
  requireAdminApi: vi.fn(),
  createUserActionToken: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  hash: vi.fn(),
}));

const prismaMock = {
  user: {
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  session: {
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  getPrismaClient: () => prismaMock,
}));

vi.mock("@/lib/auth-user", () => ({
  requireAdminApi,
}));

vi.mock("@/lib/auth-tokens", () => ({
  createUserActionToken,
}));

vi.mock("@/lib/auth-email", () => ({
  sendPasswordResetEmail,
}));

vi.mock("bcryptjs", () => ({
  hash,
}));

function jsonRequest(method: string, body: unknown) {
  return new Request("http://localhost/api/admin/users", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin users api", () => {
  beforeEach(() => {
    prismaMock.user.count.mockReset();
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.update.mockReset();
    prismaMock.session.deleteMany.mockReset();
    prismaMock.$transaction.mockReset();
    requireAdminApi.mockReset();
    createUserActionToken.mockReset();
    sendPasswordResetEmail.mockReset();
    hash.mockReset();

    requireAdminApi.mockResolvedValue({
      ok: true,
      user: {
        id: "admin-1",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
  });

  it("blocks demoting the last active admin", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      role: "ADMIN",
      status: "ACTIVE",
      playerId: "player-1",
    });
    prismaMock.user.count.mockResolvedValue(0);

    const response = await updateRole(
      jsonRequest("PATCH", { role: "PLAYER" }),
      { params: Promise.resolve({ id: "user-1" }) },
    );

    expect(response.status).toBe(409);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain("ultimo admin");
  });

  it("moves a disabled user back to active", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-2",
      role: "PLAYER",
      status: "DISABLED",
      playerId: null,
      emailVerified: new Date("2026-03-14T00:00:00.000Z"),
    });
    prismaMock.user.update.mockResolvedValue({
      id: "user-2",
      status: "ACTIVE",
    });

    const response = await updateStatus(
      jsonRequest("PATCH", { action: "reactivate" }),
      { params: Promise.resolve({ id: "user-2" }) },
    );

    expect(response.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACTIVE",
        }),
      }),
    );
  });

  it("generates a temporary password and forces password change", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-3",
      email: "player@teste.com",
      status: "ACTIVE",
    });
    hash.mockResolvedValue("hashed-password");
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<void>) => {
      await callback(prismaMock);
    });

    const response = await resetPassword(
      jsonRequest("POST", { mode: "temporary" }),
      { params: Promise.resolve({ id: "user-3" }) },
    );

    expect(response.status).toBe(200);
    expect(hash).toHaveBeenCalled();
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: "hashed-password",
          mustChangePassword: true,
        }),
      }),
    );

    const payload = (await response.json()) as { temporaryPassword: string };
    expect(payload.temporaryPassword).toBeTruthy();
  });

  it("sends the standard reset email from admin action", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-4",
      email: "player@teste.com",
      status: "ACTIVE",
    });
    createUserActionToken.mockResolvedValue({ rawToken: "reset-token" });
    sendPasswordResetEmail.mockResolvedValue(undefined);

    const response = await resetPassword(
      jsonRequest("POST", { mode: "email" }),
      { params: Promise.resolve({ id: "user-4" }) },
    );

    expect(response.status).toBe(200);
    expect(createUserActionToken).toHaveBeenCalledWith("user-4", "reset");
    expect(sendPasswordResetEmail).toHaveBeenCalledWith("player@teste.com", "reset-token");
  });
});
