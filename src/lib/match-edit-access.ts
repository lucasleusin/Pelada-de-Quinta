import { UserRole, UserStatus } from "@prisma/client";

export type MatchEditReason =
  | "ADMIN"
  | "LAST_MATCH_PLAYER"
  | "LOCKED_NOT_LAST_MATCH"
  | "LOCKED_DID_NOT_PLAY"
  | "LOCKED_NOT_ACTIVE";

export type MatchEditUser = {
  id: string;
  role: UserRole;
  status: UserStatus;
  playerId: string | null;
  mustChangePassword?: boolean | null;
};

export function resolveMatchEditAccess(input: {
  user: MatchEditUser | null;
  latestHistoricalMatchId: string | null;
  targetMatchId: string;
  didPlayTargetMatch: boolean;
}): { canEdit: boolean; editReason: MatchEditReason } {
  const { user, latestHistoricalMatchId, targetMatchId, didPlayTargetMatch } = input;

  if (!user || user.status !== UserStatus.ACTIVE || user.mustChangePassword) {
    return { canEdit: false, editReason: "LOCKED_NOT_ACTIVE" };
  }

  if (user.role === UserRole.ADMIN) {
    return { canEdit: true, editReason: "ADMIN" };
  }

  if (!user.playerId) {
    return { canEdit: false, editReason: "LOCKED_NOT_ACTIVE" };
  }

  if (!latestHistoricalMatchId || latestHistoricalMatchId !== targetMatchId) {
    return { canEdit: false, editReason: "LOCKED_NOT_LAST_MATCH" };
  }

  if (!didPlayTargetMatch) {
    return { canEdit: false, editReason: "LOCKED_DID_NOT_PLAY" };
  }

  return { canEdit: true, editReason: "LAST_MATCH_PLAYER" };
}
