"use client";

import { useEffect, useState } from "react";

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
  player: { name: string };
  totals: {
    matches: number;
    goals: number;
    assists: number;
    goalsConceded: number;
    avgRating: number;
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
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
              <div className="rounded-xl bg-emerald-50 p-3">
                Partidas: <strong>{selectedPlayerStats.totals.matches}</strong>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                Gols: <strong>{selectedPlayerStats.totals.goals}</strong>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                Assistencias: <strong>{selectedPlayerStats.totals.assists}</strong>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                Gols sofridos: <strong>{selectedPlayerStats.totals.goalsConceded}</strong>
              </div>
              <div className="rounded-xl bg-orange-50 p-3">
                Nota media: <strong>{selectedPlayerStats.totals.avgRating.toFixed(2)}</strong>
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
                      {new Date(item.match.matchDate).toLocaleDateString("pt-BR")} -{" "}
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
