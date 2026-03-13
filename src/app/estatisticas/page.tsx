"use client";

import { useEffect, useMemo, useState } from "react";
import { HeroBlock, PageShell, SectionShell, StatCard, StatusNote } from "@/components/layout/primitives";

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

export default function EstatisticasPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/stats/overview")
      .then(async (response) => {
        const payload = (await response.json()) as Overview;
        setOverview(payload);
      })
      .catch(() => setMessage("Falha ao carregar estatisticas."));
  }, []);

  const topPresence = useMemo(
    () =>
      (overview?.attendance ?? []).filter(
        (row) => row.confirmed > 0 && row.eligibleMatches > 0 && row.attendancePercentage > 0,
      ),
    [overview],
  );
  const topEfficiency = useMemo(
    () => (overview?.efficiency ?? []).filter((row) => row.matchesWithResult > 1 && row.efficiency > 0),
    [overview],
  );
  const topScorers = useMemo(() => (overview?.topScorers ?? []).filter((row) => row.goals > 0), [overview]);
  const topAssists = useMemo(() => (overview?.topAssists ?? []).filter((row) => row.assists > 0), [overview]);
  const topConceded = useMemo(
    () => (overview?.mostConceded ?? []).filter((row) => row.goalsConceded > 0),
    [overview],
  );
  const topMvp = useMemo(
    () => (overview?.mvp ?? []).filter((row) => row.averageRating > 0 && row.ratingsCount > 0),
    [overview],
  );

  return (
    <PageShell>
      <HeroBlock className="p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Indicadores</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Estatisticas Gerais</h2>
        <p className="mt-2 text-sm text-emerald-800">
          Painel consolidado do historico da pelada. As listas mostram todos os atletas com numeros acima de zero.
        </p>
      </HeroBlock>

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
