import { beforeEach, describe, expect, it, vi } from "vitest";
import { PresenceStatus } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prismaMock: {
    match: {
      findFirst: vi.fn(),
    },
    matchParticipant: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  requireAdminApi: vi.fn(),
  notifyPresenceChange: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getPrismaClient: () => mocks.prismaMock,
}));

vi.mock("@/lib/admin", () => ({
  requireAdminApi: mocks.requireAdminApi,
}));

vi.mock("@/lib/whatsapp-service", () => ({
  notifyPresenceChange: mocks.notifyPresenceChange,
}));

import { updateTeams } from "@/lib/match-service";

describe("updateTeams", () => {
  const matchId = "11111111-1111-1111-1111-111111111111";
  const playerId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    mocks.prismaMock.match.findFirst.mockReset();
    mocks.prismaMock.matchParticipant.findMany.mockReset();
    mocks.prismaMock.matchParticipant.upsert.mockReset();
    mocks.prismaMock.$transaction.mockReset();

    mocks.prismaMock.match.findFirst.mockResolvedValue({ id: matchId });
    mocks.prismaMock.matchParticipant.findMany.mockResolvedValue([]);
    mocks.prismaMock.$transaction.mockImplementation((operations: Array<Promise<unknown>>) => Promise.all(operations));
  });

  it("updates only the selected match and returns the updated participant payload", async () => {
    mocks.prismaMock.matchParticipant.upsert.mockResolvedValue({
      playerId,
      presenceStatus: PresenceStatus.CONFIRMED,
      teams: ["A"],
      primaryTeam: "A",
      goals: 0,
      assists: 0,
      goalsConceded: 0,
    });

    const response = await updateTeams(matchId, {
      assignments: [{ playerId, teams: ["A"] }],
    });
    const payload = (await response.json()) as {
      ok: boolean;
      updatedParticipants: Array<{ playerId: string; presenceStatus: PresenceStatus; teams: string[] }>;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.updatedParticipants).toEqual([
      expect.objectContaining({
        playerId,
        presenceStatus: PresenceStatus.CONFIRMED,
        teams: ["A"],
        primaryTeam: "A",
      }),
    ]);
    expect(mocks.prismaMock.matchParticipant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          matchId_playerId: {
            matchId,
            playerId,
          },
        },
        update: expect.objectContaining({
          presenceStatus: PresenceStatus.CONFIRMED,
          primaryTeam: "A",
          teams: { set: ["A"] },
        }),
        create: expect.objectContaining({
          matchId,
          playerId,
          presenceStatus: PresenceStatus.CONFIRMED,
          primaryTeam: "A",
          teams: ["A"],
        }),
      }),
    );
  });

  it("keeps the first assigned team as primary when adding a second team", async () => {
    mocks.prismaMock.matchParticipant.findMany.mockResolvedValue([
      {
        playerId,
        presenceStatus: PresenceStatus.CONFIRMED,
        confirmedAt: new Date("2030-03-01T10:00:00.000Z"),
        teams: ["B"],
        primaryTeam: null,
        teamAGoals: 0,
        teamAAssists: 0,
        teamAGoalsConceded: 0,
        teamBGoals: 0,
        teamBAssists: 0,
        teamBGoalsConceded: 0,
      },
    ]);
    mocks.prismaMock.matchParticipant.upsert.mockResolvedValue({
      playerId,
      presenceStatus: PresenceStatus.CONFIRMED,
      teams: ["A", "B"],
      primaryTeam: "B",
      goals: 0,
      assists: 0,
      goalsConceded: 0,
    });

    const response = await updateTeams(matchId, {
      assignments: [{ playerId, teams: ["A", "B"] }],
    });
    const payload = (await response.json()) as {
      updatedParticipants: Array<{ playerId: string; primaryTeam: string | null }>;
    };

    expect(response.status).toBe(200);
    expect(payload.updatedParticipants[0]?.primaryTeam).toBe("B");
    expect(mocks.prismaMock.matchParticipant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          primaryTeam: "B",
        }),
        create: expect.objectContaining({
          primaryTeam: "B",
        }),
      }),
    );
  });
});
