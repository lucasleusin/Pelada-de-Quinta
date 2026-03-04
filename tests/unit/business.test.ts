import { PresenceStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  isMatchInPast,
  isMatchOnOrBeforeToday,
  isMatchOpenForPresence,
  MAX_CONFIRMED_PLAYERS,
  pickPresenceStatusForConfirmation,
  ratingIsValid,
} from "@/lib/business";

describe("business rules", () => {
  it("allows confirmation only for matches on or after today", () => {
    const now = new Date(2026, 2, 4, 15, 0, 0);

    expect(isMatchOpenForPresence(new Date(2026, 2, 4, 0, 0, 0), now)).toBe(true);
    expect(isMatchOpenForPresence(new Date(2026, 2, 5, 0, 0, 0), now)).toBe(true);
    expect(isMatchOpenForPresence(new Date(2026, 2, 3, 0, 0, 0), now)).toBe(false);
  });

  it("identifies past matches by date", () => {
    const now = new Date(2026, 2, 4, 15, 0, 0);

    expect(isMatchInPast(new Date(2026, 2, 3, 0, 0, 0), now)).toBe(true);
    expect(isMatchInPast(new Date(2026, 2, 4, 0, 0, 0), now)).toBe(false);
  });

  it("allows post-game actions for matches on or before today", () => {
    const now = new Date(2026, 2, 4, 15, 0, 0);

    expect(isMatchOnOrBeforeToday(new Date(2026, 2, 3, 0, 0, 0), now)).toBe(true);
    expect(isMatchOnOrBeforeToday(new Date(2026, 2, 4, 0, 0, 0), now)).toBe(true);
    expect(isMatchOnOrBeforeToday(new Date(2026, 2, 5, 0, 0, 0), now)).toBe(false);
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
