"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDatePtBr } from "@/lib/date-format";
import { PlayerFifaCard, type PlayerCardPosition } from "@/components/player-fifa-card";

type RankingRow = {
  playerId: string;
  playerName: string;
  goals: number;
  assists: number;
  goalsConceded: number;
  averageRating: number;
  ratingsCount: number;
};

type AttendanceRow = {
  playerId: string;
  playerName: string;
  confirmed: number;
  eligibleMatches: number;
  attendancePercentage: number;
};

type Overview = {
  totalMatches: number;
  totalGoals: number;
  totalAssists: number;
  topScorer: { name: string; goals: number };
  topAssist: { name: string; assists: number };
  topConcededGoalkeeper: { name: string; goalsConceded: number };
  attendance: AttendanceRow[];
  topScorers: RankingRow[];
  topAssists: RankingRow[];
  mostConceded: RankingRow[];
  mvp: RankingRow[];
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
    position: PlayerCardPosition;
    shirtNumberPreference: number | null;
    photoUrl: string | null;
    email?: string | null;
    phone?: string | null;
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

type StatsViewMode = "GERAL" | "POR_JOGADOR";

export default function EstatisticasPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [selectedPlayerStats, setSelectedPlayerStats] = useState<PlayerStats | null>(null);
  const [viewMode, setViewMode] = useState<StatsViewMode>("GERAL");
  const [message, setMessage] = useState("");

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

  const topPresence = useMemo(() => overview?.attendance.slice(0, 10) ?? [], [overview]);
  const topScorers = useMemo(() => overview?.topScorers.slice(0, 10) ?? [], [overview]);
  const topAssists = useMemo(() => overview?.topAssists.slice(0, 10) ?? [], [overview]);
  const topConceded = useMemo(() => overview?.mostConceded.slice(0, 10) ?? [], [overview]);
  const topMvp = useMemo(() => overview?.mvp.slice(0, 10) ?? [], [overview]);

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h2 className="text-3xl font-bold text-emerald-950">Estatisticas</h2>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <button
            type="button"
            className={`btn ${viewMode === "GERAL" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setViewMode("GERAL")}
          >
            Geral
          </button>
          <button
            type="button"
            className={`btn ${viewMode === "POR_JOGADOR" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setViewMode("POR_JOGADOR")}
          >
            Por Jogador
          </button>

          <label className="min-w-[220px] flex-1">
            <span className="field-label">Jogador</span>
            <select
              id="player-select"
              className="field-input"
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
          </label>
        </div>
      </section>

      {viewMode === "GERAL" ? (
        <>
          <section className="card p-5">
            <h3 className="text-2xl font-bold text-emerald-950">Resumo Geral</h3>
            {overview ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-emerald-50 p-3 text-sm">
                  <p className="font-semibold text-emerald-900">Numero de Partidas</p>
                  <p className="mt-1 text-xl font-bold text-emerald-950">{overview.totalMatches}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3 text-sm">
                  <p className="font-semibold text-emerald-900">Total de Gols</p>
                  <p className="mt-1 text-xl font-bold text-emerald-950">{overview.totalGoals}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3 text-sm">
                  <p className="font-semibold text-emerald-900">Total de Assistencias</p>
                  <p className="mt-1 text-xl font-bold text-emerald-950">{overview.totalAssists}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-emerald-900">Carregando resumo geral...</p>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <RankingCard
              title="Presenca"
              rows={topPresence}
              metric={(row) => `${row.attendancePercentage.toFixed(1)}%`}
            />
            <RankingCard title="Artilharia" rows={topScorers} metric={(row) => String(row.goals)} />
            <RankingCard title="Assistencias" rows={topAssists} metric={(row) => String(row.assists)} />
            <RankingCard title="Gols Tomados" rows={topConceded} metric={(row) => String(row.goalsConceded)} />
            <RankingCard title="Nota Media" rows={topMvp} metric={(row) => row.averageRating.toFixed(2)} />
          </section>
        </>
      ) : selectedPlayerStats ? (
        <section className="card p-5">
          <h3 className="text-2xl font-bold text-emerald-950">Estatistica por jogador</h3>

          <div className="mt-4 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
            <div>
              <PlayerFifaCard
                player={{
                  name: selectedPlayerStats.player.name,
                  position: selectedPlayerStats.player.position,
                  shirtNumberPreference: selectedPlayerStats.player.shirtNumberPreference,
                  photoUrl: selectedPlayerStats.player.photoUrl,
                }}
                totals={selectedPlayerStats.totals}
                showDownloadButton
              />
            </div>

            <div className="lg:min-w-0">
              <h3 className="text-xl font-semibold text-emerald-950">
                Partidas de {selectedPlayerStats.player.name}
              </h3>
              <ul className="mt-3 space-y-3 text-sm">
                {selectedPlayerStats.history.map((item) => (
                  <li key={item.match.id} className="rounded-xl bg-zinc-50 p-3">
                    <p className="font-semibold text-emerald-900">
                      {formatDatePtBr(item.match.matchDate)} - {item.match.teamAScore ?? "-"} x{" "}
                      {item.match.teamBScore ?? "-"}
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
        </section>
      ) : (
        <section className="card p-5">
          <p className="text-sm text-emerald-900">
            Selecione um jogador para visualizar as estatisticas individuais.
          </p>
        </section>
      )}

      {message ? <p className="text-sm font-medium text-emerald-900">{message}</p> : null}
    </div>
  );
}

function RankingCard<T extends { playerId: string; playerName: string }>({
  title,
  rows,
  metric,
}: {
  title: string;
  rows: T[];
  metric: (row: T) => string;
}) {
  return (
    <section className="card p-4">
      <h4 className="text-xl font-semibold text-emerald-950">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.length === 0 ? (
          <li className="rounded-lg bg-zinc-50 px-3 py-2 text-emerald-800">Sem dados.</li>
        ) : (
          rows.map((row) => (
            <li key={row.playerId} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2">
              <span className="truncate">{row.playerName}</span>
              <span className="font-semibold">{metric(row)}</span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
