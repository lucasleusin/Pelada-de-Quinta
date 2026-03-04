import { describe, expect, it } from "vitest";
import { ratingsBatchSchema, statsBatchSchema } from "@/lib/validators";

describe("validators", () => {
  it("rejects rating outside range 0..5", () => {
    const parsed = ratingsBatchSchema.safeParse({
      ratings: [
        {
          raterPlayerId: "7f21ab95-ef41-4fc4-b073-9de6488020a8",
          ratedPlayerId: "d44ff307-eb23-40ad-962f-53d69780ceb2",
          rating: 6,
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts valid stats payload", () => {
    const parsed = statsBatchSchema.safeParse({
      createdByPlayerId: "7f21ab95-ef41-4fc4-b073-9de6488020a8",
      stats: [
        {
          playerId: "d44ff307-eb23-40ad-962f-53d69780ceb2",
          goals: 2,
          assists: 1,
          goalsConceded: 0,
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });
});
