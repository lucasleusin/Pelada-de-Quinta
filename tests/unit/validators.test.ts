import { describe, expect, it } from "vitest";
import {
  playerCreateSchema,
  playerProfileUpdateSchema,
  ratingsBatchSchema,
  statsBatchSchema,
} from "@/lib/validators";

describe("validators", () => {
  it("rejects rating outside range 1..5", () => {
    const parsed = ratingsBatchSchema.safeParse({
      ratings: [
        {
          raterPlayerId: "7f21ab95-ef41-4fc4-b073-9de6488020a8",
          ratedPlayerId: "d44ff307-eb23-40ad-962f-53d69780ceb2",
          rating: 0,
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
          teamAGoals: 2,
          teamAAssists: 1,
          teamAGoalsConceded: 0,
          teamBGoals: 0,
          teamBAssists: 0,
          teamBGoalsConceded: 0,
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid email on player create", () => {
    const parsed = playerCreateSchema.safeParse({
      name: "Jogador Teste",
      position: "MEIA",
      shirtNumberPreference: 8,
      email: "email-invalido",
      phone: "(51) 99999-9999",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects invalid phone on player create", () => {
    const parsed = playerCreateSchema.safeParse({
      name: "Jogador Teste",
      position: "MEIA",
      shirtNumberPreference: 8,
      email: "jogador@teste.com",
      phone: "abc123",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects OUTRO on profile update", () => {
    const parsed = playerProfileUpdateSchema.safeParse({
      position: "OUTRO",
    });

    expect(parsed.success).toBe(false);
  });
});
