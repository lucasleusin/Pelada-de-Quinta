import { beforeEach, describe, expect, it, vi } from "vitest";
import { Position } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prismaMock: {
    match: {
      findMany: vi.fn(),
    },
    matchParticipant: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    matchRating: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    player: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
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

import { getGeneralStatsOverview, getPlayerReport } from "@/lib/match-service";

describe("reports with primary team", () => {
  beforeEach(() => {
    mocks.prismaMock.match.findMany.mockReset();
    mocks.prismaMock.matchParticipant.aggregate.mockReset();
    mocks.prismaMock.matchParticipant.groupBy.mockReset();
    mocks.prismaMock.matchParticipant.findMany.mockReset();
    mocks.prismaMock.matchRating.aggregate.mockReset();
    mocks.prismaMock.matchRating.groupBy.mockReset();
    mocks.prismaMock.player.findUnique.mockReset();
    mocks.prismaMock.player.findMany.mockReset();
  });

  it("uses only the primary team to compute wins/losses/draws in player report", async () => {
    mocks.prismaMock.player.findUnique.mockResolvedValue({
      id: "player-1",
      name: "Marcio",
      position: Position.MEIA,
    });
    mocks.prismaMock.matchParticipant.aggregate.mockResolvedValue({
      _sum: { goals: 2, assists: 1, goalsConceded: 0 },
      _count: { _all: 1 },
    });
    mocks.prismaMock.matchRating.aggregate.mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { _all: 2 },
    });
    mocks.prismaMock.matchParticipant.findMany.mockResolvedValue([
      {
        primaryTeam: "B",
        teams: ["A", "B"],
        match: {
          id: "match-1",
          teamAScore: 2,
          teamBScore: 1,
        },
      },
    ]);

    const report = await getPlayerReport("player-1");

    expect(report?.totals.wins).toBe(0);
    expect(report?.totals.losses).toBe(1);
    expect(report?.totals.draws).toBe(0);
    expect(report?.totals.efficiency).toBe(0);
  });

  it("uses only the primary team to compute efficiency in overview", async () => {
    mocks.prismaMock.match.findMany.mockResolvedValue([{ id: "match-1" }]);
    mocks.prismaMock.matchParticipant.aggregate.mockResolvedValue({
      _sum: { goals: 3, assists: 1 },
    });
    mocks.prismaMock.matchParticipant.groupBy
      .mockResolvedValueOnce([
        {
          playerId: "player-1",
          _sum: { goals: 3, assists: 1, goalsConceded: 0 },
        },
      ])
      .mockResolvedValueOnce([
        {
          playerId: "player-1",
          _count: { _all: 1 },
        },
      ]);
    mocks.prismaMock.matchParticipant.findMany.mockResolvedValue([
      {
        playerId: "player-1",
        teams: ["A", "B"],
        primaryTeam: "B",
        match: {
          teamAScore: 2,
          teamBScore: 1,
        },
      },
    ]);
    mocks.prismaMock.player.findMany.mockResolvedValue([
      {
        id: "player-1",
        name: "Marcio",
        position: Position.MEIA,
      },
    ]);
    mocks.prismaMock.matchRating.groupBy.mockResolvedValue([]);

    const overview = await getGeneralStatsOverview();

    expect(overview.efficiency).toEqual([
      expect.objectContaining({
        playerId: "player-1",
        points: 0,
        matchesWithResult: 1,
        efficiency: 0,
      }),
    ]);
  });
});
