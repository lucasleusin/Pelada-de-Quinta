import { PresenceStatus } from "@prisma/client";

export const MAX_CONFIRMED_PLAYERS = 18;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function getMatchDateParts(date: Date): DateParts {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function getNowDateParts(date: Date, timeZone = process.env.APP_TIMEZONE || "UTC"): DateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return { year, month, day };
}

function toDateKey(date: DateParts): number {
  return date.year * 10000 + date.month * 100 + date.day;
}

function compareMatchDateToToday(matchDate: Date, now: Date): number {
  return toDateKey(getMatchDateParts(matchDate)) - toDateKey(getNowDateParts(now));
}

export function isMatchOpenForPresence(matchDate: Date, now: Date = new Date()): boolean {
  return compareMatchDateToToday(matchDate, now) >= 0;
}

export function isMatchInPast(matchDate: Date, now: Date = new Date()): boolean {
  return compareMatchDateToToday(matchDate, now) < 0;
}

export function isMatchOnOrBeforeToday(matchDate: Date, now: Date = new Date()): boolean {
  return compareMatchDateToToday(matchDate, now) <= 0;
}

export function pickPresenceStatusForConfirmation(confirmedCount: number): PresenceStatus {
  return confirmedCount >= MAX_CONFIRMED_PLAYERS
    ? PresenceStatus.WAITLIST
    : PresenceStatus.CONFIRMED;
}

export function ratingIsValid(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}
