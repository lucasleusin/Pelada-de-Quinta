type RedirectUserState = {
  role?: "ADMIN" | "PLAYER" | null;
  status?:
    | "PENDING_VERIFICATION"
    | "PENDING_APPROVAL"
    | "ACTIVE"
    | "DISABLED"
    | "REJECTED"
    | null;
  playerId?: string | null;
  mustChangePassword?: boolean | null;
};

export function resolveAuthenticatedLandingPath(user: RedirectUserState) {
  if (user.mustChangePassword) {
    return "/redefinir-senha?modo=obrigatorio";
  }

  if (user.status !== "ACTIVE" || !user.playerId) {
    return "/conta";
  }

  return "/meu-perfil";
}

export function isAccountReadyForPlayerArea(user: RedirectUserState) {
  return user.status === "ACTIVE" && Boolean(user.playerId) && !user.mustChangePassword;
}

export function canAccessAdminArea(user: RedirectUserState) {
  return user.role === "ADMIN" && user.status === "ACTIVE" && !user.mustChangePassword;
}
