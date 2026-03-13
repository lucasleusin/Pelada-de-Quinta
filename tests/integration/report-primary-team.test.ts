import { beforeEach, describe, expect, it, vi } from "vitest";
import { Position } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prismaMock: {
    match: {
      findMany: vi.fn(),
    },
    matchParticipant: {
      findMany: vi.fn(),
    },
    matchRating: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
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
    mocks.prismaMock.matchParticipant.findMany.mockReset();
    mocks.prismaMock.matchRating.aggregate.mockReset();
    mocks.prismaMock.matchRating.findMany.mockReset();
    mocks.prismaMock.player.findUnique.mockReset();
    mocks.prismaMock.player.findMany.mockReset();
  });

  it("uses only the primary team to compute wins/losses/draws in player report", async () => {
    mocks.prismaMock.player.findUnique.mockResolvedValue({
      id: "player-1",
      name: "Marcio",
      position: Position.MEIA,
    });
    mocks.prismaMock.matchRating.aggregate.mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { _all: 2 },
    });
    mocks.prismaMock.matchRating.findMany.mockResolvedValue([
      { matchId: "match-1", rating: 4 },
      { matchId: "match-1", rating: 5 },
    ]);
    mocks.prismaMock.matchParticipant.findMany.mockResolvedValue([
      {
        matchId: "match-1",
        goals: 0,
        assists: 0,
        goalsConceded: 0,
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
    mocks.prismaMock.matchParticipant.findMany.mockResolvedValue([
      {
        matchId: "match-1",
        playerId: "player-1",
        goals: 3,
        assists: 1,
        goalsConceded: 0,
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
    mocks.prismaMock.matchRating.findMany.mockResolvedValue([]);

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

  it("ignores confirmed entries without team assignment in player report", async () => {
    mocks.prismaMock.player.findUnique.mockResolvedValue({
      id: "player-1",
      name: "Bernardo",
      position: Position.ZAGUEIRO,
    });
    mocks.prismaMock.matchParticipant.findMany.mockResolvedValue([
      {
        matchId: "match-1",
        goals: 0,
        assists: 1,
        goalsConceded: 0,
        teams: ["A"],
        primaryTeam: "A",
        match: {
          id: "match-1",
          teamAScore: 1,
          teamBScore: 0,
        },
      },
      {
        matchId: "match-2",
        goals: 0,
        assists: 2,
        goalsConceded: 0,
        teams: ["B"],
        primaryTeam: "A",
        match: {
          id: "match-2",
          teamAScore: 0,
          teamBScore: 2,
        },
      },
    ]);
    mocks.prismaMock.matchRating.aggregate.mockResolvedValue({
      _avg: { rating: 3.5 },
      _count: { _all: 2 },
    });
    mocks.prismaMock.matchRating.findMany.mockResolvedValue([
      { matchId: "match-1", rating: 4 },
      { matchId: "match-2", rating: 3 },
    ]);

    const report = await getPlayerReport("player-1");

    expect(report?.totals.matches).toBe(2);
    expect(report?.history).toHaveLength(2);
    expect(report?.totals.wins).toBe(2);
    expect(report?.totals.losses).toBe(0);
  });

  it("ignores ratings for players without a valid team assignment in overview", async () => {
    mocks.prismaMock.match.findMany.mockResolvedValue([{ id: "match-1" }]);
    mocks.prismaMock.matchParticipant.findMany.mockResolvedValue([
      {
        matchId: "match-1",
        playerId: "player-1",
        goals: 0,
        assists: 0,
        goalsConceded: 0,
        teams: ["A"],
        primaryTeam: "A",
        match: {
          teamAScore: 1,
          teamBScore: 0,
        },
      },
    ]);
    mocks.prismaMock.player.findMany.mockResolvedValue([
      {
        id: "player-1",
        name: "Bernardo",
        position: Position.ZAGUEIRO,
      },
    ]);
    mocks.prismaMock.matchRating.findMany.mockResolvedValue([
      { matchId: "match-1", ratedPlayerId: "player-1", rating: 5 },
      { matchId: "match-1", ratedPlayerId: "ghost-player", rating: 1 },
    ]);

    const overview = await getGeneralStatsOverview();

    expect(overview.mvp).toEqual([
      expect.objectContaining({
        playerId: "player-1",
        averageRating: 5,
        ratingsCount: 1,
      }),
    ]);
  });
});
