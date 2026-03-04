import { MatchStatus, PresenceStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canConfirmPresence, MAX_CONFIRMED_PLAYERS, pickPresenceStatusForConfirmation, ratingIsValid } from "@/lib/business";

describe("business rules", () => {
  it("allow confirmation only in CONFIRMATION_OPEN", () => {
    expect(canConfirmPresence(MatchStatus.CONFIRMATION_OPEN)).toBe(true);
    expect(canConfirmPresence(MatchStatus.DRAFT)).toBe(false);
    expect(canConfirmPresence(MatchStatus.FINISHED)).toBe(false);
  });

  it("sends overflow players to waitlist after 18 confirmations", () => {
    expect(pickPresenceStatusForConfirmation(MAX_CONFIRMED_PLAYERS - 1)).toBe(PresenceStatus.CONFIRMED);
    expect(pickPresenceStatusForConfirmation(MAX_CONFIRMED_PLAYERS)).toBe(PresenceStatus.WAITLIST);
    expect(pickPresenceStatusForConfirmation(MAX_CONFIRMED_PLAYERS + 5)).toBe(PresenceStatus.WAITLIST);
  });

  it("validates ratings between 0 and 5", () => {
    expect(ratingIsValid(0)).toBe(true);
    expect(ratingIsValid(5)).toBe(true);
    expect(ratingIsValid(3)).toBe(true);
    expect(ratingIsValid(-1)).toBe(false);
    expect(ratingIsValid(6)).toBe(false);
    expect(ratingIsValid(2.5)).toBe(false);
  });
});
