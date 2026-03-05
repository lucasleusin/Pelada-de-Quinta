"use client";

import { useEffect, useRef, useState } from "react";
import { Bebas_Neue, Barlow_Condensed } from "next/font/google";
import { formatDatePtBr } from "@/lib/date-format";
import styles from "./player-card.module.css";

type PlayerPosition = "GOLEIRO" | "ZAGUEIRO" | "MEIA" | "ATACANTE" | "OUTRO";

type Overview = {
  totalMatches: number;
  totalGoals: number;
  topScorer: { name: string; goals: number };
  topAssist: { name: string; assists: number };
  topConcededGoalkeeper: { name: string; goalsConceded: number };
};

type Player = {
  id: string;
  name: string;
  photoUrl: string | null;
};

type PlayerStats = {
  player: {
    id: string;
    name: string;
    position: PlayerPosition;
    shirtNumberPreference: number | null;
    photoUrl: string | null;
  };
  totals: {
    matches: number;
    goals: number;
    assists: number;
    goalsConceded: number;
    avgRating: number;
    wins: number;
    losses: number;
    draws: number;
    goalsPerMatch: number;
    efficiency: number;
    avgGoalsPerMatch: number;
    avgAssistsPerMatch: number;
    avgConcededPerMatch: number;
  };
  history: Array<{
    match: {
      id: string;
      matchDate: string;
      teamAScore: number | null;
      teamBScore: number | null;
    };
    goals: number;
    assists: number;
    goalsConceded: number;
  }>;
};

const positionLabel: Record<PlayerPosition, string> = {
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

export default function EstatisticasPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [selectedPlayerStats, setSelectedPlayerStats] = useState<PlayerStats | null>(null);
  const [message, setMessage] = useState("");
  const [isDownloadingCard, setIsDownloadingCard] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/stats/overview"), fetch("/api/players")])
      .then(async ([overviewRes, playersRes]) => {
        const overviewPayload = (await overviewRes.json()) as Overview;
        const playersPayload = (await playersRes.json()) as Player[];
        setOverview(overviewPayload);
        setPlayers(playersPayload);
      })
      .catch(() => setMessage("Falha ao carregar estatisticas."));
  }, []);

  async function handleSelectPlayer(playerId: string) {
    setSelectedPlayerId(playerId);

    if (!playerId) {
      setSelectedPlayerStats(null);
      return;
    }

    const response = await fetch(`/api/players/${playerId}/history`, { cache: "no-store" });
    if (!response.ok) {
      setMessage("Nao foi possivel carregar estatisticas do jogador.");
      return;
    }

    const payload = (await response.json()) as PlayerStats;
    const fallbackPhotoUrl = players.find((player) => player.id === playerId)?.photoUrl ?? null;

    setSelectedPlayerStats({
      ...payload,
      player: {
        ...payload.player,
        photoUrl: payload.player.photoUrl ?? fallbackPhotoUrl,
      },
    });
  }

  async function downloadPlayerCardPng() {
    if (!selectedPlayerStats || !cardRef.current) return;

    setIsDownloadingCard(true);

    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });

      const safeName = selectedPlayerStats.player.name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `card-${safeName || "jogador"}.png`;
      link.click();
    } catch {
      setMessage("Nao foi possivel gerar o PNG do card.");
    } finally {
      setIsDownloadingCard(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h2 className="text-3xl font-bold text-emerald-950">Historico Geral</h2>
        {overview ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl bg-emerald-50 p-3 text-sm">
              <p className="font-semibold text-emerald-900">Numero de Partidas</p>
              <p className="mt-1 text-xl font-bold text-emerald-950">{overview.totalMatches}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-sm">
              <p className="font-semibold text-emerald-900">Numero de Gols</p>
              <p className="mt-1 text-xl font-bold text-emerald-950">{overview.totalGoals}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-sm">
              <p className="font-semibold text-emerald-900">Artilheiro</p>
              <p className="mt-1 text-base font-bold text-emerald-950">
                {overview.topScorer.name} ({overview.topScorer.goals})
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-sm">
              <p className="font-semibold text-emerald-900">Lider de Assistencia</p>
              <p className="mt-1 text-base font-bold text-emerald-950">
                {overview.topAssist.name} ({overview.topAssist.assists})
              </p>
            </div>
            <div className="rounded-xl bg-orange-50 p-3 text-sm">
              <p className="font-semibold text-emerald-900">Frangueiro</p>
              <p className="mt-1 text-base font-bold text-emerald-950">
                {overview.topConcededGoalkeeper.name} ({overview.topConcededGoalkeeper.goalsConceded})
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-emerald-900">Carregando historico geral...</p>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-3xl font-bold text-emerald-950">Estatistica por jogador</h2>
        <label className="field-label mt-4" htmlFor="player-select">
          Escolha o jogador
        </label>
        <select
          id="player-select"
          className="field-input max-w-md"
          value={selectedPlayerId}
          onChange={(event) => handleSelectPlayer(event.currentTarget.value)}
        >
          <option value="">Selecione...</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>

        {selectedPlayerStats ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
            <div className="flex flex-col items-center gap-2 lg:items-start">
              <div ref={cardRef} className={`${styles.card} ${barlow.className}`}>
              <div className={styles.cardBg} />

              <div className={styles.dot} style={{ width: 8, height: 8, background: "#fff", top: "15%", left: "8%" }} />
              <div className={styles.dot} style={{ width: 5, height: 5, background: "#FFDF00", top: "25%", left: "88%" }} />
              <div className={styles.dot} style={{ width: 6, height: 6, background: "#fff", top: "52%", left: "5%" }} />
              <div className={styles.dot} style={{ width: 10, height: 10, background: "#FFDF00", top: "10%", left: "55%", opacity: 0.3 }} />

              <div className={`${styles.bigNumber} ${bebas.className}`}>
                {selectedPlayerStats.player.shirtNumberPreference ?? "--"}
              </div>

              <div className={styles.topBar}>
                <div className={`${styles.editionBadge} ${bebas.className}`}>PELADA DE QUINTA</div>
                <div className={`${styles.shirtNumberBadge} ${bebas.className}`}>
                  #{selectedPlayerStats.player.shirtNumberPreference ?? "--"}
                </div>
              </div>

              <div className={styles.stars} aria-label="avaliacao media">
                {Array.from({ length: 5 }).map((_, index) => (
                  <span
                    key={index}
                    className={index < getFilledStars(selectedPlayerStats.totals.avgRating) ? styles.starFilled : styles.starEmpty}
                  >
                    ★
                  </span>
                ))}
              </div>

              <div className={styles.playerWrap}>
                <div className={styles.playerPlaceholder}>
                  {selectedPlayerStats.player.photoUrl ? (
                    <img
                      src={selectedPlayerStats.player.photoUrl}
                      alt={`Foto de ${selectedPlayerStats.player.name}`}
                      className={styles.playerImage}
                    />
                  ) : (
                    <>
                      <span className={styles.placeholderIcon}>📷</span>
                      <span className={styles.placeholderText}>
                        {getInitials(selectedPlayerStats.player.name)}
                        <br />
                        Sem foto
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.playerGlow} />

              <div className={styles.infoPanel}>
                {(() => {
                  const split = splitNameForAccent(selectedPlayerStats.player.name);
                  return (
                    <div className={`${styles.playerName} ${bebas.className}`}>
                      <span className={styles.playerNameAccent}>{split.accent}</span>
                      {split.rest}
                    </div>
                  );
                })()}
                <div className={styles.subtitle}>
                  {positionLabel[selectedPlayerStats.player.position]}
                </div>

                <div className={styles.statsGrid}>
                  <div className={styles.statsRow}>
                    <div className={styles.stat}>
                      <div className={`${styles.statValue} ${bebas.className}`}>{selectedPlayerStats.totals.matches}</div>
                      <div className={styles.statLabel}>Partidas Jogadas</div>
                    </div>
                    <div className={styles.stat}>
                      <div className={`${styles.statValue} ${bebas.className}`}>{selectedPlayerStats.totals.avgRating.toFixed(1)}</div>
                      <div className={styles.statLabel}>Nota Geral</div>
                    </div>
                    <div className={styles.stat}>
                      <div className={`${styles.statValue} ${bebas.className}`}>{selectedPlayerStats.totals.efficiency.toFixed(1)}%</div>
                      <div className={styles.statLabel}>Aproveitamento</div>
                    </div>
                  </div>

                  <div className={styles.statsRow}>
                    <div className={styles.stat}>
                      <div className={`${styles.statValue} ${bebas.className}`}>{selectedPlayerStats.totals.wins}</div>
                      <div className={styles.statLabel}>Vitorias</div>
                    </div>
                    <div className={styles.stat}>
                      <div className={`${styles.statValue} ${bebas.className}`}>{selectedPlayerStats.totals.draws}</div>
                      <div className={styles.statLabel}>Empates</div>
                    </div>
                    <div className={styles.stat}>
                      <div className={`${styles.statValue} ${bebas.className}`}>{selectedPlayerStats.totals.losses}</div>
                      <div className={styles.statLabel}>Derrotas</div>
                    </div>
                  </div>

                  <div className={styles.statsRow}>
                    <div className={styles.stat}>
                      <div className={`${styles.statValue} ${bebas.className}`}>{selectedPlayerStats.totals.goals}</div>
                      <div className={styles.statLabel}>Gols</div>
                    </div>
                    <div className={styles.stat}>
                      <div className={`${styles.statValue} ${bebas.className}`}>{selectedPlayerStats.totals.assists}</div>
                      <div className={styles.statLabel}>Assistencias</div>
                    </div>
                    <div className={styles.stat}>
                      <div className={`${styles.statValue} ${bebas.className}`}>{selectedPlayerStats.totals.goalsConceded}</div>
                      <div className={styles.statLabel}>Gols Sofridos</div>
                    </div>
                  </div>

                  <div className={styles.statsRow}>
                    <div className={styles.stat}>
                      <div className={`${styles.statValue} ${bebas.className}`}>{selectedPlayerStats.totals.avgGoalsPerMatch.toFixed(2)}</div>
                      <div className={styles.statLabel}>Media Gols</div>
                    </div>
                    <div className={styles.stat}>
                      <div className={`${styles.statValue} ${bebas.className}`}>{selectedPlayerStats.totals.avgAssistsPerMatch.toFixed(2)}</div>
                      <div className={styles.statLabel}>Media Assist.</div>
                    </div>
                    <div className={styles.stat}>
                      <div className={`${styles.statValue} ${bebas.className}`}>{selectedPlayerStats.totals.avgConcededPerMatch.toFixed(2)}</div>
                      <div className={styles.statLabel}>Media G. Sofridos</div>
                    </div>
                  </div>
                </div>
              </div>

                <div className={styles.shimmer} />
              </div>
              <button
                className="btn btn-primary"
                type="button"
                onClick={downloadPlayerCardPng}
                disabled={isDownloadingCard}
              >
                {isDownloadingCard ? "Gerando PNG..." : "Baixar card em PNG"}
              </button>
            </div>

            <div className="lg:min-w-0">
              <h3 className="text-xl font-semibold text-emerald-950">
                Partidas de {selectedPlayerStats.player.name}
              </h3>
              <ul className="mt-3 space-y-3 text-sm">
                {selectedPlayerStats.history.map((item) => (
                  <li key={item.match.id} className="rounded-xl bg-zinc-50 p-3">
                    <p className="font-semibold text-emerald-900">
                      {formatDatePtBr(item.match.matchDate)} -{" "}
                      {item.match.teamAScore ?? "-"} x {item.match.teamBScore ?? "-"}
                    </p>
                    <p>
                      Gols: {item.goals} | Assistencias: {item.assists} | Gols sofridos:{" "}
                      {item.goalsConceded}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-emerald-900">Escolha um jogador para visualizar os dados.</p>
        )}
      </section>

      {message ? <p className="text-sm font-medium text-emerald-900">{message}</p> : null}
    </div>
  );
}
