import { describe, expect, it } from "vitest";
import {
  adminPasswordResetSchema,
  changePasswordSchema,
  accountProfileUpdateSchema,
  mergeEntitiesSchema,
  playerCreateSchema,
  playerProfileUpdateSchema,
  ratingsBatchSchema,
  siteSettingsUpdateSchema,
  statsBatchSchema,
  userRoleUpdateSchema,
  userStatusUpdateSchema,
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

  it("accepts valid site settings payload", () => {
    const parsed = siteSettingsUpdateSchema.safeParse({
      siteName: "Lo Sports FC",
      siteShortName: "Lo Sports",
      siteDescription: "Liga semanal com estatisticas e confirmacao de presenca.",
      locationLabel: "Porto Alegre",
      headerBadge: "Temporada 2026",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts valid account profile payload", () => {
    const parsed = accountProfileUpdateSchema.safeParse({
      name: "Lucas Leusin",
      email: "lucas@teste.com",
      nickname: "Lucas",
      position: "MEIA",
      shirtNumberPreference: 10,
      whatsApp: "(51) 99999-9999",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid role update", () => {
    const parsed = userRoleUpdateSchema.safeParse({
      role: "SUPERADMIN",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts valid status update action", () => {
    const parsed = userStatusUpdateSchema.safeParse({
      action: "reactivate",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts admin password reset modes", () => {
    expect(adminPasswordResetSchema.safeParse({ mode: "email" }).success).toBe(true);
    expect(adminPasswordResetSchema.safeParse({ mode: "temporary" }).success).toBe(true);
    expect(changePasswordSchema.safeParse({ password: "NovaSenha123!" }).success).toBe(true);
  });

  it("requires a full pair when merging players", () => {
    expect(
      mergeEntitiesSchema.safeParse({
        action: "preview",
        primaryPlayerId: "player-1",
        secondaryPlayerId: "",
      }).success,
    ).toBe(false);

    expect(
      mergeEntitiesSchema.safeParse({
        action: "preview",
        primaryPlayerId: "player-1",
        secondaryPlayerId: "player-2",
      }).success,
    ).toBe(true);
  });
});

