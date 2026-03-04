function extractDateParts(value: string | Date) {
  if (value instanceof Date) {
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
    };
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  };
}

export function formatDatePtBr(value: string | Date) {
  const parts = extractDateParts(value);
  if (!parts) return "-";

  const day = String(parts.day).padStart(2, "0");
  const month = String(parts.month).padStart(2, "0");
  const year = String(parts.year);
  return `${day}/${month}/${year}`;
}

export function getDateSortValue(value: string | Date) {
  const parts = extractDateParts(value);
  if (!parts) return 0;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}
