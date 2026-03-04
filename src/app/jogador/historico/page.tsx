"use client";

import { useEffect, useState } from "react";

type HistoryResponse = {
  player: { name: string };
  totals: {
    matches: number;
    goals: number;
    assists: number;
    goalsConceded: number;
    avgRating: number;
  };
  history: Array<{
    match: { id: string; matchDate: string; teamAScore: number | null; teamBScore: number | null };
    goals: number;
    assists: number;
    goalsConceded: number;
  }>;
};

export default function HistoricoJogadorPage() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [playerId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("pelada:selectedPlayerId") : null,
  );

  useEffect(() => {
    if (!playerId) {
      return;
    }

    fetch(`/api/players/${playerId}/history`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Falha ao carregar historico.");
        }
        const payload = (await res.json()) as HistoryResponse;
        setData(payload);
      })
      .catch((err: Error) => setError(err.message));
  }, [playerId]);

  if (!playerId) {
    return <p className="card p-4 text-sm text-emerald-900">Selecione seu jogador em &quot;Quem e voce?&quot;.</p>;
  }

  if (error) {
    return <p className="card p-4 text-sm text-emerald-900">{error}</p>;
  }

  if (!data) {
    return <p className="card p-4 text-sm text-emerald-900">Carregando historico...</p>;
  }

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="text-3xl font-bold text-emerald-950">Historico de {data.player.name}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
          <div className="rounded-xl bg-emerald-50 p-3">Partidas: {data.totals.matches}</div>
          <div className="rounded-xl bg-emerald-50 p-3">Gols: {data.totals.goals}</div>
          <div className="rounded-xl bg-emerald-50 p-3">Assistencias: {data.totals.assists}</div>
          <div className="rounded-xl bg-emerald-50 p-3">Gols sofridos: {data.totals.goalsConceded}</div>
          <div className="rounded-xl bg-orange-50 p-3">Media nota: {data.totals.avgRating.toFixed(2)}</div>
        </div>
      </section>

      <section className="card p-5">
        <h3 className="text-xl font-semibold text-emerald-950">Partidas</h3>
        <ul className="mt-3 space-y-3 text-sm">
          {data.history.map((item) => (
            <li key={item.match.id} className="rounded-xl bg-zinc-50 p-3">
              <p className="font-semibold text-emerald-900">
                {new Date(item.match.matchDate).toLocaleDateString("pt-BR")} - {item.match.teamAScore ?? "-"} x{" "}
                {item.match.teamBScore ?? "-"}
              </p>
              <p>
                Gols: {item.goals} | Assistencias: {item.assists} | Gols sofridos: {item.goalsConceded}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
