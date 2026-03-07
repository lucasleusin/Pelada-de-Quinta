"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDatePtBr } from "@/lib/date-format";
import { PlayerFifaCard, type PlayerCardPosition } from "@/components/player-fifa-card";
import {
  HeroBlock,
  PageShell,
  SectionShell,
  StatCard,
  StatusNote,
} from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";

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

type EfficiencyRow = {
  playerId: string;
  playerName: string;
  points: number;
  matchesWithResult: number;
  efficiency: number;
};

type Overview = {
  totalMatches: number;
  totalGoals: number;
  totalAssists: number;
  topScorer: { name: string; goals: number };
  topAssist: { name: string; assists: number };
  topConcededGoalkeeper: { name: string; goalsConceded: number };
  efficiency: EfficiencyRow[];
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

    setViewMode("POR_JOGADOR");

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

  const topPresence = useMemo(
    () =>
      (overview?.attendance ?? [])
        .filter((row) => row.confirmed > 0 && row.eligibleMatches > 0 && row.attendancePercentage > 0)
        .slice(0, 10),
    [overview],
  );
  const topEfficiency = useMemo(
    () => (overview?.efficiency ?? []).filter((row) => row.matchesWithResult > 0),
    [overview],
  );
  const topScorers = useMemo(
    () => (overview?.topScorers ?? []).filter((row) => row.goals > 0),
    [overview],
  );
  const topAssists = useMemo(() => (overview?.topAssists ?? []).filter((row) => row.assists > 0).slice(0, 10), [overview]);
  const topConceded = useMemo(
    () => (overview?.mostConceded ?? []).filter((row) => row.goalsConceded > 0).slice(0, 10),
    [overview],
  );
  const topMvp = useMemo(
    () => (overview?.mvp ?? []).filter((row) => row.averageRating > 0 && row.ratingsCount > 0).slice(0, 10),
    [overview],
  );

  function showGeneralView() {
    setViewMode("GERAL");
    setSelectedPlayerId("");
    setSelectedPlayerStats(null);
  }

  return (
    <PageShell>
      <HeroBlock className="p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Indicadores</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Estatisticas</h2>

        <div className="mt-4 action-bar p-3">
          <div className="flex flex-wrap items-end gap-2">
            <Button
              type="button"
              className="rounded-full"
              variant={viewMode === "GERAL" ? "default" : "outline"}
              onClick={showGeneralView}
            >
              Geral
            </Button>

            <label className="min-w-[220px] flex-1">
              <span className="field-label">Por Jogador</span>
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
        </div>
      </HeroBlock>

      {viewMode === "GERAL" ? (
        <>
          <SectionShell className="p-5">
            <h3 className="text-2xl font-bold text-emerald-950">Resumo Geral</h3>
            {overview ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <StatCard>
                  <p className="text-sm font-semibold text-emerald-900">Numero de Partidas</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-950">{overview.totalMatches}</p>
                </StatCard>
                <StatCard>
                  <p className="text-sm font-semibold text-emerald-900">Total de Gols</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-950">{overview.totalGoals}</p>
                </StatCard>
                <StatCard>
                  <p className="text-sm font-semibold text-emerald-900">Total de Assistencias</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-950">{overview.totalAssists}</p>
                </StatCard>
              </div>
            ) : (
              <p className="mt-3 text-sm text-emerald-900">Carregando resumo geral...</p>
            )}
          </SectionShell>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <RankingCard
              title="Aproveitamento"
              rows={topEfficiency}
              metric={(row) => `${row.efficiency.toFixed(1)}% (${row.points})`}
            />
            <RankingCard
              title="Presenca"
              rows={topPresence}
              metric={(row) => `${row.attendancePercentage.toFixed(1)}%`}
            />
            <RankingCard title="Gols Marcados" rows={topScorers} metric={(row) => String(row.goals)} />
            <RankingCard title="Gols Tomados" rows={topConceded} metric={(row) => String(row.goalsConceded)} />
            <RankingCard title="Assistencia" rows={topAssists} metric={(row) => String(row.assists)} />
            <RankingCard title="Nota" rows={topMvp} metric={(row) => row.averageRating.toFixed(2)} />
          </div>
        </>
      ) : selectedPlayerStats ? (
        <SectionShell className="p-5">
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
                  <li key={item.match.id} className="rounded-xl border border-emerald-100 bg-zinc-50 p-3">
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
        </SectionShell>
      ) : (
        <SectionShell className="p-5">
          <p className="empty-state text-sm">
            Selecione um jogador para visualizar as estatisticas individuais.
          </p>
        </SectionShell>
      )}

      {message ? <StatusNote tone="error">{message}</StatusNote> : null}
    </PageShell>
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
    <SectionShell className="p-4">
      <h4 className="text-xl font-semibold text-emerald-950">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.length === 0 ? (
          <li className="empty-state text-sm">Sem dados.</li>
        ) : (
          rows.map((row) => (
            <li key={row.playerId} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2">
              <span className="truncate">{row.playerName}</span>
              <span className="font-semibold">{metric(row)}</span>
            </li>
          ))
        )}
      </ul>
    </SectionShell>
  );
}
