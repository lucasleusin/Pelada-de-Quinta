import { describe, expect, it } from "vitest";
import { mergeParticipantRecords, planMergedRatings } from "@/lib/user-merge";

describe("user merge helpers", () => {
  it("sums stats when both duplicated players were on the same team", () => {
    const merged = mergeParticipantRecords(
      {
        presenceStatus: "CONFIRMED",
        confirmedAt: new Date("2026-03-14T19:00:00.000Z"),
        teams: ["A"],
        primaryTeam: "A",
        playedAsGoalkeeper: false,
        teamAGoals: 1,
        teamAAssists: 2,
        teamAGoalsConceded: 0,
        teamBGoals: 0,
        teamBAssists: 0,
        teamBGoalsConceded: 0,
        statsUpdatedByPlayerId: null,
      },
      {
        presenceStatus: "CONFIRMED",
        confirmedAt: new Date("2026-03-14T19:05:00.000Z"),
        teams: ["A"],
        primaryTeam: "A",
        playedAsGoalkeeper: true,
        teamAGoals: 2,
        teamAAssists: 1,
        teamAGoalsConceded: 1,
        teamBGoals: 0,
        teamBAssists: 0,
        teamBGoalsConceded: 0,
        statsUpdatedByPlayerId: "player-secondary",
      },
    );

    expect(merged.teams).toEqual(["A"]);
    expect(merged.primaryTeam).toBe("A");
    expect(merged.playedAsGoalkeeper).toBe(true);
    expect(merged.teamAGoals).toBe(3);
    expect(merged.teamAAssists).toBe(3);
    expect(merged.teamAGoalsConceded).toBe(1);
    expect(merged.goals).toBe(3);
    expect(merged.assists).toBe(3);
    expect(merged.goalsConceded).toBe(1);
  });

  it("keeps split stats when duplicated players appeared on opposite teams in the same match", () => {
    const merged = mergeParticipantRecords(
      {
        presenceStatus: "CONFIRMED",
        confirmedAt: new Date("2026-03-14T19:00:00.000Z"),
        teams: ["A"],
        primaryTeam: "A",
        playedAsGoalkeeper: false,
        teamAGoals: 1,
        teamAAssists: 0,
        teamAGoalsConceded: 2,
        teamBGoals: 0,
        teamBAssists: 0,
        teamBGoalsConceded: 0,
        statsUpdatedByPlayerId: null,
      },
      {
        presenceStatus: "CONFIRMED",
        confirmedAt: new Date("2026-03-14T19:02:00.000Z"),
        teams: ["B"],
        primaryTeam: "B",
        playedAsGoalkeeper: false,
        teamAGoals: 0,
        teamAAssists: 0,
        teamAGoalsConceded: 0,
        teamBGoals: 2,
        teamBAssists: 1,
        teamBGoalsConceded: 1,
        statsUpdatedByPlayerId: null,
      },
    );

    expect(merged.teams).toEqual(["A", "B"]);
    expect(merged.primaryTeam).toBe("A");
    expect(merged.teamAGoals).toBe(1);
    expect(merged.teamBGoals).toBe(2);
    expect(merged.teamBAssists).toBe(1);
    expect(merged.goals).toBe(3);
    expect(merged.goalsConceded).toBe(3);
  });

  it("keeps the highest duplicate rating and removes self-ratings after merge", () => {
    const plan = planMergedRatings(
      [
        {
          id: "rating-1",
          matchId: "match-1",
          raterPlayerId: "player-primary",
          ratedPlayerId: "player-target",
          rating: 3,
          createdAt: new Date("2026-03-14T20:00:00.000Z"),
        },
        {
          id: "rating-2",
          matchId: "match-1",
          raterPlayerId: "player-secondary",
          ratedPlayerId: "player-target",
          rating: 5,
          createdAt: new Date("2026-03-14T20:05:00.000Z"),
        },
        {
          id: "rating-3",
          matchId: "match-1",
          raterPlayerId: "player-target",
          ratedPlayerId: "player-secondary",
          rating: 4,
          createdAt: new Date("2026-03-14T20:06:00.000Z"),
        },
        {
          id: "rating-4",
          matchId: "match-2",
          raterPlayerId: "player-primary",
          ratedPlayerId: "player-secondary",
          rating: 2,
          createdAt: new Date("2026-03-14T20:07:00.000Z"),
        },
      ],
      "player-primary",
      "player-secondary",
    );

    expect(plan.deletions).toContain("rating-1");
    expect(plan.deletions).toContain("rating-4");
    expect(plan.updates).toEqual([
      {
        id: "rating-2",
        raterPlayerId: "player-primary",
        ratedPlayerId: "player-target",
      },
      {
        id: "rating-3",
        raterPlayerId: "player-target",
        ratedPlayerId: "player-primary",
      },
    ]);
  });
});
