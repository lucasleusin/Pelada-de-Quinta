import { beforeEach, describe, expect, it, vi } from "vitest";
import { PresenceStatus } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prismaMock: {
    match: {
      findFirst: vi.fn(),
    },
    matchParticipant: {
      findUnique: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
    },
    player: {
      findUnique: vi.fn(),
    },
  },
  notifyPresenceChange: vi.fn(),
  requireAdminApi: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getPrismaClient: () => mocks.prismaMock,
}));

vi.mock("@/lib/whatsapp-service", () => ({
  notifyPresenceChange: mocks.notifyPresenceChange,
}));

vi.mock("@/lib/admin", () => ({
  requireAdminApi: mocks.requireAdminApi,
}));

import { cancelPresence, confirmPresence, updateParticipantPresence } from "@/lib/match-service";

function makeMatch() {
  return {
    id: "match-1",
    matchDate: new Date("2030-03-07T00:00:00.000Z"),
    startTime: "19:00",
    location: "Arena dos Coqueiros",
  };
}

describe("presence flow with whatsapp notifications", () => {
  beforeEach(() => {
    mocks.prismaMock.match.findFirst.mockReset();
    mocks.prismaMock.matchParticipant.findUnique.mockReset();
    mocks.prismaMock.matchParticipant.count.mockReset();
    mocks.prismaMock.matchParticipant.upsert.mockReset();
    mocks.prismaMock.player.findUnique.mockReset();
    mocks.notifyPresenceChange.mockReset();
    mocks.requireAdminApi.mockReset();

    mocks.prismaMock.match.findFirst.mockResolvedValue(makeMatch());
    mocks.prismaMock.player.findUnique.mockResolvedValue({ id: "player-1", name: "Marcio" });
    mocks.requireAdminApi.mockResolvedValue({ ok: true, admin: { id: "admin-1" } });
  });

  it("notifies admins when a player confirms", async () => {
    mocks.prismaMock.matchParticipant.findUnique.mockResolvedValue(null);
    mocks.prismaMock.matchParticipant.count.mockResolvedValue(0);
    mocks.prismaMock.matchParticipant.upsert.mockResolvedValue({
      id: "participant-1",
      playerId: "player-1",
      matchId: "match-1",
      presenceStatus: PresenceStatus.CONFIRMED,
    });

    const response = await confirmPresence("match-1", "player-1");

    expect(response.status).toBe(200);
    expect(mocks.notifyPresenceChange).toHaveBeenCalledTimes(1);
    expect(mocks.notifyPresenceChange).toHaveBeenCalledWith({
      previousStatus: null,
      nextStatus: PresenceStatus.CONFIRMED,
      player: { id: "player-1", name: "Marcio" },
      match: expect.objectContaining({ id: "match-1" }),
    });
  });

  it("does not notify when confirm is a no-op", async () => {
    mocks.prismaMock.matchParticipant.findUnique.mockResolvedValue({
      id: "participant-1",
      presenceStatus: PresenceStatus.CONFIRMED,
    });

    const response = await confirmPresence("match-1", "player-1");

    expect(response.status).toBe(200);
    expect(mocks.prismaMock.matchParticipant.upsert).not.toHaveBeenCalled();
    expect(mocks.notifyPresenceChange).not.toHaveBeenCalled();
  });

  it("does not notify when manual update stays canceled", async () => {
    mocks.prismaMock.matchParticipant.findUnique.mockResolvedValue({
      id: "participant-1",
      presenceStatus: PresenceStatus.CANCELED,
    });
    mocks.prismaMock.matchParticipant.upsert.mockResolvedValue({
      id: "participant-1",
      playerId: "player-1",
      matchId: "match-1",
      presenceStatus: PresenceStatus.CANCELED,
    });

    const response = await updateParticipantPresence("match-1", "player-1", {
      presenceStatus: PresenceStatus.CANCELED,
    });

    expect(response.status).toBe(200);
    expect(mocks.notifyPresenceChange).not.toHaveBeenCalled();
  });

  it("keeps cancellation successful even when whatsapp notification fails", async () => {
    mocks.prismaMock.matchParticipant.findUnique.mockResolvedValue({
      id: "participant-1",
      presenceStatus: PresenceStatus.CONFIRMED,
    });
    mocks.prismaMock.matchParticipant.upsert.mockResolvedValue({
      id: "participant-1",
      playerId: "player-1",
      matchId: "match-1",
      presenceStatus: PresenceStatus.CANCELED,
    });
    mocks.notifyPresenceChange.mockRejectedValue(new Error("Twilio offline"));

    const response = await cancelPresence("match-1", "player-1");
    const payload = (await response.json()) as { presenceStatus: PresenceStatus };

    expect(response.status).toBe(200);
    expect(payload.presenceStatus).toBe(PresenceStatus.CANCELED);
  });
});
