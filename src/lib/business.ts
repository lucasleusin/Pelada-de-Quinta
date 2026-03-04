import { MatchStatus, PresenceStatus } from "@prisma/client";

export const MAX_CONFIRMED_PLAYERS = 18;

export function canConfirmPresence(status: MatchStatus): boolean {
  return status === MatchStatus.CONFIRMATION_OPEN;
}

export function pickPresenceStatusForConfirmation(confirmedCount: number): PresenceStatus {
  return confirmedCount >= MAX_CONFIRMED_PLAYERS
    ? PresenceStatus.WAITLIST
    : PresenceStatus.CONFIRMED;
}

export function ratingIsValid(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 0 && rating <= 5;
}
