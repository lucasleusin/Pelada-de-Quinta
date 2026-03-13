import { ImageResponse } from "next/og";
import { getCachedSiteSettings } from "@/lib/site-settings";

const BRAND_GREEN = "#0e6b3d";
const BRAND_GREEN_STRONG = "#0a5b33";
const BRAND_ORANGE = "#f07b3f";

function buildIconInitials(siteName: string) {
  const words = siteName
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 1);

  if (words.length === 0) {
    return "PQ";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] ?? "P"}${words[words.length - 1][0] ?? "Q"}`.toUpperCase();
}

export async function buildPwaIconResponse(size: number) {
  const settings = await getCachedSiteSettings();
  const initials = buildIconInitials(settings.siteName);
  const locationLabel = settings.locationLabel.trim() || "Cachoeira do Sul";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: `linear-gradient(145deg, ${BRAND_GREEN} 0%, ${BRAND_GREEN_STRONG} 62%, ${BRAND_ORANGE} 100%)`,
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: size * 0.06,
            borderRadius: size * 0.2,
            border: `${Math.max(4, Math.round(size * 0.02))}px solid rgba(255,255,255,0.14)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: size * 0.09,
            right: size * 0.09,
            width: size * 0.2,
            height: size * 0.2,
            borderRadius: 999,
            background: "rgba(255,255,255,0.16)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: size * -0.08,
            right: size * -0.08,
            width: size * 0.42,
            height: size * 0.42,
            borderRadius: 999,
            background: "rgba(255,255,255,0.1)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            width: "100%",
            padding: `${Math.round(size * 0.16)}px ${Math.round(size * 0.14)}px`,
          }}
        >
          <div
            style={{
              fontSize: size * 0.11,
              fontWeight: 700,
              letterSpacing: size * 0.012,
              textTransform: "uppercase",
              opacity: 0.9,
            }}
          >
            Pelada da Quinta
          </div>
          <div
            style={{
              marginTop: size * 0.035,
              fontSize: size * 0.42,
              lineHeight: 0.9,
              fontWeight: 800,
              letterSpacing: size * -0.01,
            }}
          >
            {initials}
          </div>
          <div
            style={{
              marginTop: size * 0.05,
              fontSize: size * 0.09,
              fontWeight: 600,
              letterSpacing: size * 0.007,
              textTransform: "uppercase",
              opacity: 0.92,
            }}
          >
            {locationLabel}
          </div>
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
    },
  );
}
