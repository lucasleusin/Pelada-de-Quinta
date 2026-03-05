"use client";

import { useEffect, useState } from "react";
import { formatDatePtBr } from "@/lib/date-format";

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
};

type PlayerStats = {
  player: {
    id: string;
    name: string;
    position: PlayerPosition;
    shirtNumberPreference: number | null;
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

export default function EstatisticasPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [selectedPlayerStats, setSelectedPlayerStats] = useState<PlayerStats | null>(null);
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

    const response = await fetch(`/api/players/${playerId}/history`);
    if (!response.ok) {
      setMessage("Nao foi possivel carregar estatisticas do jogador.");
      return;
    }

    const payload = (await response.json()) as PlayerStats;
    setSelectedPlayerStats(payload);
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
          <div className="mt-4 space-y-4">
            <div className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-100 via-white to-orange-100 p-4 shadow-sm md:p-5">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-200/50" />
              <div className="pointer-events-none absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-orange-200/40" />

              <div className="relative text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  Card do Jogador
                </p>
                <p className="mt-1 text-3xl font-black leading-tight text-emerald-950">
                  {selectedPlayerStats.player.name}
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2 md:mx-auto md:max-w-sm">
                  <div className="rounded-xl border border-emerald-300 bg-white/90 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Numero</p>
                    <p className="text-xl font-black leading-none text-emerald-950">
                      {selectedPlayerStats.player.shirtNumberPreference ?? "--"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-300 bg-white/90 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Posicao</p>
                    <p className="text-xl font-black leading-none text-emerald-950">
                      {positionLabel[selectedPlayerStats.player.position]}
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
                <div className="rounded-xl border border-orange-200 bg-white/90 p-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-700">Nota geral</p>
                  <p className="text-lg font-bold text-emerald-950">{selectedPlayerStats.totals.avgRating.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-white/90 p-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-700">Partidas jogadas</p>
                  <p className="text-lg font-bold text-emerald-950">{selectedPlayerStats.totals.matches}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-white/90 p-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-700">Gols marcados</p>
                  <p className="text-lg font-bold text-emerald-950">{selectedPlayerStats.totals.goals}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-white/90 p-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-700">Assistencias</p>
                  <p className="text-lg font-bold text-emerald-950">{selectedPlayerStats.totals.assists}</p>
                </div>
                {selectedPlayerStats.totals.goalsConceded > 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-white/90 p-2">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-700">Gols sofridos</p>
                    <p className="text-lg font-bold text-emerald-950">{selectedPlayerStats.totals.goalsConceded}</p>
                  </div>
                ) : null}
                <div className="rounded-xl border border-emerald-200 bg-white/90 p-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-700">Vitorias</p>
                  <p className="text-lg font-bold text-emerald-950">{selectedPlayerStats.totals.wins}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-white/90 p-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-700">Derrotas</p>
                  <p className="text-lg font-bold text-emerald-950">{selectedPlayerStats.totals.losses}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-white/90 p-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-700">Empates</p>
                  <p className="text-lg font-bold text-emerald-950">{selectedPlayerStats.totals.draws}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-white/90 p-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-700">Media gol/jogo</p>
                  <p className="text-lg font-bold text-emerald-950">{selectedPlayerStats.totals.goalsPerMatch.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-white/90 p-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-700">Aproveitamento</p>
                  <p className="text-lg font-bold text-emerald-950">{selectedPlayerStats.totals.efficiency.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div>
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
