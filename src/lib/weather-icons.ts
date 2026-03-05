export type IconKey = "SUN" | "CLOUD_SUN" | "CLOUD" | "FOG" | "DRIZZLE" | "RAIN" | "STORM" | "SNOW";

export function mapWeatherCodeToIconKey(code: number): IconKey {
  if (code === 0) return "SUN";
  if (code === 1 || code === 2) return "CLOUD_SUN";
  if (code === 3) return "CLOUD";
  if (code === 45 || code === 48) return "FOG";
  if ([51, 53, 55, 56, 57].includes(code)) return "DRIZZLE";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "RAIN";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "SNOW";
  if ([95, 96, 99].includes(code)) return "STORM";
  return "CLOUD";
}
