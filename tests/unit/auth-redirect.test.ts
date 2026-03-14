import { describe, expect, it } from "vitest";
import { canAccessAdminArea, isAccountReadyForPlayerArea, resolveAuthenticatedLandingPath } from "@/lib/auth-redirect";

describe("auth redirect helpers", () => {
  it("sends pending accounts to onboarding", () => {
    expect(
      resolveAuthenticatedLandingPath({
        role: "PLAYER",
        status: "PENDING_APPROVAL",
        playerId: null,
        mustChangePassword: false,
      }),
    ).toBe("/conta");
  });

  it("forces password change when required", () => {
    expect(
      resolveAuthenticatedLandingPath({
        role: "PLAYER",
        status: "ACTIVE",
        playerId: "player-1",
        mustChangePassword: true,
      }),
    ).toBe("/redefinir-senha?modo=obrigatorio");
  });

  it("marks active linked player account as ready", () => {
    expect(
      isAccountReadyForPlayerArea({
        status: "ACTIVE",
        playerId: "player-1",
        mustChangePassword: false,
      }),
    ).toBe(true);
  });

  it("allows only active admins into admin area", () => {
    expect(
      canAccessAdminArea({
        role: "ADMIN",
        status: "ACTIVE",
        playerId: "player-1",
        mustChangePassword: false,
      }),
    ).toBe(true);

    expect(
      canAccessAdminArea({
        role: "PLAYER",
        status: "ACTIVE",
        playerId: "player-1",
        mustChangePassword: false,
      }),
    ).toBe(false);
  });
});
