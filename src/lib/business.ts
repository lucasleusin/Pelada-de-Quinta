import { PresenceStatus } from "@prisma/client";

export const MAX_CONFIRMED_PLAYERS = 18;

function toStartOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function isMatchOpenForPresence(matchDate: Date, now: Date = new Date()): boolean {
  return toStartOfDay(matchDate).getTime() >= toStartOfDay(now).getTime();
}

export function isMatchInPast(matchDate: Date, now: Date = new Date()): boolean {
  return toStartOfDay(matchDate).getTime() < toStartOfDay(now).getTime();
}

export function isMatchOnOrBeforeToday(matchDate: Date, now: Date = new Date()): boolean {
  return toStartOfDay(matchDate).getTime() <= toStartOfDay(now).getTime();
}

export function pickPresenceStatusForConfirmation(confirmedCount: number): PresenceStatus {
  return confirmedCount >= MAX_CONFIRMED_PLAYERS
    ? PresenceStatus.WAITLIST
    : PresenceStatus.CONFIRMED;
}

export function ratingIsValid(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}
