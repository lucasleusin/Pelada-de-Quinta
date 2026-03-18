import { describe, expect, it } from "vitest";
import { resolveMatchEditAccess } from "@/lib/match-edit-access";

describe("resolveMatchEditAccess", () => {
  it("allows active admins to edit any previous match", () => {
    expect(
      resolveMatchEditAccess({
        user: {
          id: "admin-1",
          role: "ADMIN",
          status: "ACTIVE",
          playerId: "player-admin",
          mustChangePassword: false,
        },
        latestHistoricalMatchId: "match-2",
        targetMatchId: "match-1",
        didPlayTargetMatch: false,
      }),
    ).toEqual({ canEdit: true, editReason: "ADMIN" });
  });

  it("allows active players to edit only the latest previous match they played", () => {
    expect(
      resolveMatchEditAccess({
        user: {
          id: "user-1",
          role: "PLAYER",
          status: "ACTIVE",
          playerId: "player-1",
          mustChangePassword: false,
        },
        latestHistoricalMatchId: "match-2",
        targetMatchId: "match-2",
        didPlayTargetMatch: true,
      }),
    ).toEqual({ canEdit: true, editReason: "LAST_MATCH_PLAYER" });
  });

  it("blocks active players from editing an older match", () => {
    expect(
      resolveMatchEditAccess({
        user: {
          id: "user-1",
          role: "PLAYER",
          status: "ACTIVE",
          playerId: "player-1",
          mustChangePassword: false,
        },
        latestHistoricalMatchId: "match-3",
        targetMatchId: "match-2",
        didPlayTargetMatch: true,
      }),
    ).toEqual({ canEdit: false, editReason: "LOCKED_NOT_LAST_MATCH" });
  });

  it("blocks active players who did not play the latest previous match", () => {
    expect(
      resolveMatchEditAccess({
        user: {
          id: "user-1",
          role: "PLAYER",
          status: "ACTIVE",
          playerId: "player-1",
          mustChangePassword: false,
        },
        latestHistoricalMatchId: "match-3",
        targetMatchId: "match-3",
        didPlayTargetMatch: false,
      }),
    ).toEqual({ canEdit: false, editReason: "LOCKED_DID_NOT_PLAY" });
  });

  it("blocks users who are not active", () => {
    expect(
      resolveMatchEditAccess({
        user: {
          id: "user-1",
          role: "PLAYER",
          status: "PENDING_APPROVAL",
          playerId: "player-1",
          mustChangePassword: false,
        },
        latestHistoricalMatchId: "match-3",
        targetMatchId: "match-3",
        didPlayTargetMatch: true,
      }),
    ).toEqual({ canEdit: false, editReason: "LOCKED_NOT_ACTIVE" });
  });
});
