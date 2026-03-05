import { NextResponse } from "next/server";
import { mapWeatherCodeToIconKey } from "@/lib/weather-icons";

const CACHOEIRA_DO_SUL = {
  latitude: -30.04,
  longitude: -52.89,
};

function toIsoDate(value: string | null) {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.slice(0, 10);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toHourMinute(value: string | null) {
  if (!value) return "19:00";
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) ? value : null;
}

function toComparableTimestamp(isoDateTime: string) {
  const [datePart, timePart] = isoDateTime.split("T");
  if (!datePart || !timePart) return Number.NaN;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  if ([year, month, day, hour, minute].some((part) => Number.isNaN(part))) {
    return Number.NaN;
  }
  return Date.UTC(year, month - 1, day, hour, minute, 0);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const matchDate = toIsoDate(searchParams.get("matchDate"));
  const startTime = toHourMinute(searchParams.get("startTime"));

  if (!matchDate || !startTime) {
    return NextResponse.json(
      { error: "Parametros invalidos. Informe matchDate e startTime no formato esperado." },
      { status: 400 },
    );
  }

  const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
  endpoint.searchParams.set("latitude", String(CACHOEIRA_DO_SUL.latitude));
  endpoint.searchParams.set("longitude", String(CACHOEIRA_DO_SUL.longitude));
  endpoint.searchParams.set("hourly", "weather_code,temperature_2m");
  endpoint.searchParams.set("timezone", "America/Sao_Paulo");
  endpoint.searchParams.set("forecast_days", "16");

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { accept: "application/json" },
      next: { revalidate: 900 },
    });
  } catch {
    return NextResponse.json({ error: "Falha ao consultar previsao do tempo." }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json({ error: "Falha ao consultar previsao do tempo." }, { status: 502 });
  }

  const payload = (await response.json()) as {
    hourly?: { time?: string[]; weather_code?: number[]; temperature_2m?: number[] };
  };

  const times = payload.hourly?.time ?? [];
  const weatherCodes = payload.hourly?.weather_code ?? [];
  const temperatures = payload.hourly?.temperature_2m ?? [];

  if (
    times.length === 0 ||
    weatherCodes.length === 0 ||
    temperatures.length === 0 ||
    times.length !== weatherCodes.length ||
    times.length !== temperatures.length
  ) {
    return NextResponse.json({ error: "Previsao indisponivel no momento." }, { status: 502 });
  }

  const targetDateTime = `${matchDate}T${startTime}`;
  const targetTimestamp = toComparableTimestamp(targetDateTime);

  let bestIndex = -1;
  let smallestDiff = Number.POSITIVE_INFINITY;

  for (let index = 0; index < times.length; index += 1) {
    const timestamp = toComparableTimestamp(times[index]);
    const weatherCode = weatherCodes[index];
    if (Number.isNaN(timestamp) || typeof weatherCode !== "number") continue;
    const diff = Math.abs(timestamp - targetTimestamp);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      bestIndex = index;
    }
  }

  if (bestIndex < 0) {
    return NextResponse.json({ error: "Previsao indisponivel no momento." }, { status: 502 });
  }

  const weatherCode = weatherCodes[bestIndex];
  const temperature = temperatures[bestIndex];

  if (typeof temperature !== "number" || Number.isNaN(temperature)) {
    return NextResponse.json({ error: "Previsao indisponivel no momento." }, { status: 502 });
  }

  return NextResponse.json({
    iconKey: mapWeatherCodeToIconKey(weatherCode),
    weatherCode,
    temperatureC: Math.round(temperature),
  });
}
