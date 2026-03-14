"use client";

import { useRef, useState } from "react";
import { Bebas_Neue, Barlow_Condensed } from "next/font/google";
import { useSiteSettings } from "@/components/site-settings-provider";
import styles from "@/components/player-fifa-card.module.css";

export type PlayerCardPosition = "GOLEIRO" | "ZAGUEIRO" | "MEIA" | "ATACANTE" | "OUTRO";

export type PlayerCardPlayer = {
  name: string;
  position: PlayerCardPosition;
  shirtNumberPreference: number | null;
  photoUrl: string | null;
};

export type PlayerCardTotals = {
  matches: number;
  avgRating: number;
  efficiency: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
  goalsConceded: number;
  avgGoalsPerMatch: number;
  avgAssistsPerMatch: number;
  avgConcededPerMatch: number;
};

type PlayerFifaCardProps = {
  player: PlayerCardPlayer;
  totals: PlayerCardTotals;
  showDownloadButton?: boolean;
};

const positionLabel: Record<PlayerCardPosition, string> = {
  GOLEIRO: "Goleiro",
  ZAGUEIRO: "Zagueiro",
  MEIA: "Meio Campo",
  ATACANTE: "Atacante",
  OUTRO: "Outro",
};

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
});

const barlow = Barlow_Condensed({
  weight: ["400", "600", "700", "900"],
  subsets: ["latin"],
});

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "JG";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function splitNameForAccent(name: string) {
  const normalized = name.trim().toUpperCase();
  if (!normalized) return { accent: "", rest: "" };
  if (normalized.length <= 5) return { accent: normalized, rest: "" };
  return { accent: normalized.slice(0, 5), rest: normalized.slice(5) };
}

function getFilledStars(avgRating: number) {
  const clamped = Math.max(0, Math.min(5, avgRating));
  return Math.round(clamped);
}

export function PlayerFifaCard({
  player,
  totals,
  showDownloadButton = false,
}: PlayerFifaCardProps) {
  const siteSettings = useSiteSettings();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const cardRef = useRef<HTMLDivElement | null>(null);

  async function downloadCardAsPng() {
    if (!cardRef.current) return;

    setIsDownloading(true);
    setDownloadError("");

    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });

      const safeName = player.name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `card-${safeName || "jogador"}.png`;
      link.click();
    } catch {
      setDownloadError("Nao foi possivel gerar o PNG do card.");
    } finally {
      setIsDownloading(false);
    }
  }

  const splitName = splitNameForAccent(player.name);

  return (
    <div className="flex flex-col items-center gap-2 lg:items-start">
      <div ref={cardRef} className={`${styles.card} ${barlow.className}`}>
        <div className={styles.cardBg} />

        <div className={styles.dot} style={{ width: 8, height: 8, background: "#fff", top: "15%", left: "8%" }} />
        <div className={styles.dot} style={{ width: 5, height: 5, background: "#FFDF00", top: "25%", left: "88%" }} />
        <div className={styles.dot} style={{ width: 6, height: 6, background: "#fff", top: "52%", left: "5%" }} />
        <div className={styles.dot} style={{ width: 10, height: 10, background: "#FFDF00", top: "10%", left: "55%", opacity: 0.3 }} />

        <div className={`${styles.bigNumber} ${bebas.className}`}>
          {player.shirtNumberPreference ?? "--"}
        </div>

        <div className={styles.topBar}>
          <div className={`${styles.editionBadge} ${bebas.className}`}>{siteSettings.siteName.toUpperCase()}</div>
          <div className={`${styles.shirtNumberBadge} ${bebas.className}`}>
            #{player.shirtNumberPreference ?? "--"}
          </div>
        </div>

        <div className={styles.stars} aria-label="avaliacao media">
          {Array.from({ length: 5 }).map((_, index) => (
            <span key={index} className={index < getFilledStars(totals.avgRating) ? styles.starFilled : styles.starEmpty}>
              {"\u2605"}
            </span>
          ))}
        </div>

        <div className={styles.playerWrap}>
          <div className={styles.playerPlaceholder}>
            {player.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.photoUrl} alt={`Foto de ${player.name}`} className={styles.playerImage} />
            ) : (
              <>
                <span className={styles.placeholderIcon}>{"\u{1F4F7}"}</span>
                <span className={styles.placeholderText}>
                  {getInitials(player.name)}
                  <br />
                  Sem foto
                </span>
              </>
            )}
          </div>
        </div>

        <div className={styles.playerGlow} />

        <div className={styles.infoPanel}>
          <div className={`${styles.playerName} ${bebas.className}`}>
            <span className={styles.playerNameAccent}>{splitName.accent}</span>
            {splitName.rest}
          </div>
          <div className={styles.subtitle}>{positionLabel[player.position]}</div>

          <div className={styles.statsGrid}>
            <div className={styles.statsRow}>
              <div className={styles.stat}>
                <div className={`${styles.statValue} ${bebas.className}`}>{totals.matches}</div>
                <div className={styles.statLabel}>Partidas Jogadas</div>
              </div>
              <div className={styles.stat}>
                <div className={`${styles.statValue} ${bebas.className}`}>{totals.avgRating.toFixed(1)}</div>
                <div className={styles.statLabel}>Nota Geral</div>
              </div>
              <div className={styles.stat}>
                <div className={`${styles.statValue} ${bebas.className}`}>{totals.efficiency.toFixed(1)}%</div>
                <div className={styles.statLabel}>Aproveitamento</div>
              </div>
            </div>

            <div className={styles.statsRow}>
              <div className={styles.stat}>
                <div className={`${styles.statValue} ${bebas.className}`}>{totals.wins}</div>
                <div className={styles.statLabel}>Vitorias</div>
              </div>
              <div className={styles.stat}>
                <div className={`${styles.statValue} ${bebas.className}`}>{totals.draws}</div>
                <div className={styles.statLabel}>Empates</div>
              </div>
              <div className={styles.stat}>
                <div className={`${styles.statValue} ${bebas.className}`}>{totals.losses}</div>
                <div className={styles.statLabel}>Derrotas</div>
              </div>
            </div>

            <div className={styles.statsRow}>
              <div className={styles.stat}>
                <div className={`${styles.statValue} ${bebas.className}`}>{totals.goals}</div>
                <div className={styles.statLabel}>Gols</div>
              </div>
              <div className={styles.stat}>
                <div className={`${styles.statValue} ${bebas.className}`}>{totals.assists}</div>
                <div className={styles.statLabel}>Assistencias</div>
              </div>
              <div className={styles.stat}>
                <div className={`${styles.statValue} ${bebas.className}`}>{totals.goalsConceded}</div>
                <div className={styles.statLabel}>Gols Sofridos</div>
              </div>
            </div>

            <div className={styles.statsRow}>
              <div className={styles.stat}>
                <div className={`${styles.statValue} ${bebas.className}`}>{totals.avgGoalsPerMatch.toFixed(2)}</div>
                <div className={styles.statLabel}>Media Gols</div>
              </div>
              <div className={styles.stat}>
                <div className={`${styles.statValue} ${bebas.className}`}>{totals.avgAssistsPerMatch.toFixed(2)}</div>
                <div className={styles.statLabel}>Media Assist.</div>
              </div>
              <div className={styles.stat}>
                <div className={`${styles.statValue} ${bebas.className}`}>{totals.avgConcededPerMatch.toFixed(2)}</div>
                <div className={styles.statLabel}>Media G. Sofridos</div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.shimmer} />
      </div>

      {showDownloadButton ? (
        <button className="btn btn-primary" type="button" onClick={downloadCardAsPng} disabled={isDownloading}>
          {isDownloading ? "Gerando PNG..." : "Baixar card em PNG"}
        </button>
      ) : null}

      {downloadError ? <p className="text-sm text-red-700">{downloadError}</p> : null}
    </div>
  );
}
