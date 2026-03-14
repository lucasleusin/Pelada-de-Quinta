import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/account/profile/route";

const { requireAuthenticatedApi, createUserActionToken, sendVerificationEmail } = vi.hoisted(() => ({
  requireAuthenticatedApi: vi.fn(),
  createUserActionToken: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));

const prismaMock = {
  user: {
    update: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  getPrismaClient: () => prismaMock,
}));

vi.mock("@/lib/auth-user", () => ({
  requireAuthenticatedApi,
}));

vi.mock("@/lib/auth-tokens", () => ({
  createUserActionToken,
}));

vi.mock("@/lib/auth-email", () => ({
  sendVerificationEmail,
}));

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/account/profile", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("account profile api", () => {
  beforeEach(() => {
    prismaMock.user.update.mockReset();
    requireAuthenticatedApi.mockReset();
    createUserActionToken.mockReset();
    sendVerificationEmail.mockReset();

    requireAuthenticatedApi.mockResolvedValue({
      ok: true,
      user: {
        id: "user-1",
        email: "lucas@old.com",
        name: "Lucas",
        nickname: "Lu",
        position: "MEIA",
        shirtNumberPreference: 10,
        whatsApp: "(51) 99999-9999",
        role: "PLAYER",
        status: "PENDING_APPROVAL",
        playerId: null,
        mustChangePassword: false,
        emailVerified: new Date("2026-03-14T00:00:00.000Z"),
      },
    });
    createUserActionToken.mockResolvedValue({ rawToken: "verify-token" });
    sendVerificationEmail.mockResolvedValue(undefined);
  });

  it("returns the authenticated account snapshot", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { email: string; status: string };
    expect(payload.email).toBe("lucas@old.com");
    expect(payload.status).toBe("PENDING_APPROVAL");
  });

  it("sends a fresh verification email when the user changes email", async () => {
    prismaMock.user.update.mockResolvedValue({
      id: "user-1",
      name: "Lucas Leusin",
      email: "lucas@new.com",
      nickname: "Lucas",
      position: "MEIA",
      shirtNumberPreference: 10,
      whatsApp: "(51) 99999-9999",
      role: "PLAYER",
      status: "PENDING_VERIFICATION",
      playerId: null,
      mustChangePassword: false,
      emailVerified: null,
    });

    const response = await PUT(
      makeRequest({
        name: "Lucas Leusin",
        email: "lucas@new.com",
      }),
    );

    expect(response.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "lucas@new.com",
          emailVerified: null,
          status: "PENDING_VERIFICATION",
        }),
      }),
    );
    expect(createUserActionToken).toHaveBeenCalledWith("user-1", "verify");
    expect(sendVerificationEmail).toHaveBeenCalledWith("lucas@new.com", "verify-token");
  });

  it("keeps rejected users rejected even when they change email", async () => {
    requireAuthenticatedApi.mockResolvedValue({
      ok: true,
      user: {
        id: "user-1",
        email: "lucas@old.com",
        name: "Lucas",
        nickname: null,
        position: null,
        shirtNumberPreference: null,
        whatsApp: null,
        role: "PLAYER",
        status: "REJECTED",
        playerId: null,
        mustChangePassword: false,
        emailVerified: null,
      },
    });
    prismaMock.user.update.mockResolvedValue({
      id: "user-1",
      name: "Lucas",
      email: "lucas@new.com",
      nickname: null,
      position: null,
      shirtNumberPreference: null,
      whatsApp: null,
      role: "PLAYER",
      status: "REJECTED",
      playerId: null,
      mustChangePassword: false,
      emailVerified: null,
    });

    const response = await PUT(
      makeRequest({
        name: "Lucas",
        email: "lucas@new.com",
      }),
    );

    expect(response.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          status: "PENDING_VERIFICATION",
        }),
      }),
    );
  });
});
