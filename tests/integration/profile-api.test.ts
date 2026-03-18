import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUT } from "@/app/api/players/[id]/profile/route";

const prismaMock = {
  $transaction: vi.fn(),
  player: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  user: {
    update: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  getPrismaClient: () => prismaMock,
}));

vi.mock("@/lib/auth-user", () => ({
  getCurrentUser: vi.fn(async () => ({
    id: "user-1",
    role: "PLAYER",
    status: "ACTIVE",
    playerId: "player-1",
  })),
}));

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/players/player-1/profile", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("profile api route", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset();
    prismaMock.player.findFirst.mockReset();
    prismaMock.player.update.mockReset();
    prismaMock.user.update.mockReset();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock));
  });

  it("updates player profile successfully", async () => {
    prismaMock.player.findFirst.mockResolvedValue({ id: "player-1" });
    prismaMock.player.update.mockResolvedValue({
      id: "player-1",
      name: "Novo Nome",
      nickname: "Novo",
      position: "MEIA",
      shirtNumberPreference: 10,
      email: "novo@teste.com",
      phone: "(51) 99999-9999",
      photoUrl: null,
      photoPath: null,
      isActive: true,
    });

    const response = await PUT(makeRequest({
      name: "Novo Nome",
      position: "MEIA",
      shirtNumberPreference: 10,
      email: "novo@teste.com",
      phone: "(51) 99999-9999",
    }), {
      params: Promise.resolve({ id: "player-1" }),
    });

    expect(response.status).toBe(200);

    const payload = (await response.json()) as { name: string; email: string };
    expect(payload.name).toBe("Novo Nome");
    expect(payload.email).toBe("novo@teste.com");
  });

  it("returns 409 when email is duplicated", async () => {
    prismaMock.player.findFirst.mockResolvedValue({ id: "player-1" });
    prismaMock.player.update.mockRejectedValue({
      code: "P2002",
      meta: { target: ["email"] },
    });

    const response = await PUT(makeRequest({
      email: "duplicado@teste.com",
    }), {
      params: Promise.resolve({ id: "player-1" }),
    });

    expect(response.status).toBe(409);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain("Email");
  });

  it("returns 400 for invalid phone", async () => {
    const response = await PUT(makeRequest({
      phone: "abc123",
    }), {
      params: Promise.resolve({ id: "player-1" }),
    });

    expect(response.status).toBe(400);
  });
});
