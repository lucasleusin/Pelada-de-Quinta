import { describe, expect, it } from "vitest";
import { PresenceStatus } from "@prisma/client";
import { MAX_CONFIRMED_PLAYERS, pickPresenceStatusForConfirmation } from "@/lib/business";

describe("presence integration flow", () => {
  it("fills confirmed slots and starts waitlist after capacity", () => {
    const statuses: PresenceStatus[] = [];

    for (let index = 0; index < MAX_CONFIRMED_PLAYERS + 2; index += 1) {
      const confirmedCount = statuses.filter((status) => status === PresenceStatus.CONFIRMED).length;
      statuses.push(pickPresenceStatusForConfirmation(confirmedCount));
    }

    const confirmed = statuses.filter((status) => status === PresenceStatus.CONFIRMED).length;
    const waitlist = statuses.filter((status) => status === PresenceStatus.WAITLIST).length;

    expect(confirmed).toBe(MAX_CONFIRMED_PLAYERS);
    expect(waitlist).toBe(2);
  });
});
