import { Position, Prisma, UserStatus } from "@prisma/client";
import { randomBytes } from "crypto";

type UserSnapshot = {
  name: string | null;
  nickname: string | null;
  position: Position | null;
  shirtNumberPreference: number | null;
  email: string;
  whatsApp: string | null;
};

export function buildPlayerPatchFromUserSnapshot(user: UserSnapshot) {
  const patch: Prisma.PlayerUpdateInput = {
    name: user.name ?? undefined,
    nickname: user.nickname ?? undefined,
    position: user.position ?? undefined,
    shirtNumberPreference: user.shirtNumberPreference ?? undefined,
    email: user.email,
    phone: user.whatsApp ?? undefined,
  };

  return patch;
}

export function getDisabledReactivationStatus(user: { playerId: string | null }) {
  return user.playerId ? UserStatus.ACTIVE : UserStatus.PENDING_APPROVAL;
}

export function getRejectedReopenStatus(user: { emailVerified: Date | null }) {
  return user.emailVerified ? UserStatus.PENDING_APPROVAL : UserStatus.PENDING_VERIFICATION;
}

export function generateTemporaryPassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(length);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
