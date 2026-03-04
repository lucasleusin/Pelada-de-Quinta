"use client";

import { useEffect, useMemo, useState } from "react";
import { StarRating } from "@/components/star-rating";

type Participant = {
  playerId: string;
  player: { id: string; name: string };
  team: "A" | "B" | null;
  goals: number;
  assists: number;
  goalsConceded: number;
  playedAsGoalkeeper: boolean;
};

type MatchPayload = {
  id: string;
  status: string;
  participants: Participant[];
};

export default function PosJogoPage({ params }: { params: { id: string } }) {
  const [match, setMatch] = useState<MatchPayload | null>(null);
  const [stats, setStats] = useState<Record<string, { goals: number; assists: number; goalsConceded: number }>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    fetch(`/api/matches/${params.id}`)
      .then((res) => res.json())
      .then((data: MatchPayload) => {
        setMatch(data);
        const initialStats: Record<string, { goals: number; assists: number; goalsConceded: number }> = {};
        for (const participant of data.participants) {
          initialStats[participant.playerId] = {
            goals: participant.goals,
            assists: participant.assists,
            goalsConceded: participant.goalsConceded,
          };
        }
        setStats(initialStats);
      })
      .catch(() => setMessage("Falha ao carregar partida."));
  }, [params.id]);

  const currentPlayerId = useMemo(
    () => (typeof window !== "undefined" ? localStorage.getItem("pelada:selectedPlayerId") : null),
    [],
  );

  const participants = match?.participants ?? [];

  function updateStat(playerId: string, field: "goals" | "assists" | "goalsConceded", value: number) {
    setStats((prev) => ({
      ...prev,
      [playerId]: {
        goals: prev[playerId]?.goals ?? 0,
        assists: prev[playerId]?.assists ?? 0,
        goalsConceded: prev[playerId]?.goalsConceded ?? 0,
        [field]: Number.isNaN(value) ? 0 : Math.max(0, value),
      },
    }));
  }

  async function saveStats() {
    if (!match) return;

    const payload = {
      createdByPlayerId: currentPlayerId ?? undefined,
      stats: participants.map((participant) => ({
        playerId: participant.playerId,
        goals: stats[participant.playerId]?.goals ?? 0,
        assists: stats[participant.playerId]?.assists ?? 0,
        goalsConceded: stats[participant.playerId]?.goalsConceded ?? 0,
      })),
    };

    const response = await fetch(`/api/matches/${match.id}/stats`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const payloadError = await response.json().catch(() => ({ error: "Erro ao salvar estatisticas." }));
      setMessage(payloadError.error ?? "Erro ao salvar estatisticas.");
      return;
    }

    setMessage("Estatisticas salvas.");
  }

  async function saveRatings() {
    if (!match || !currentPlayerId) {
      setMessage("Selecione seu jogador para avaliar.");
      return;
    }

    const payload = {
      ratings: Object.entries(ratings).map(([ratedPlayerId, rating]) => ({
        raterPlayerId: currentPlayerId,
        ratedPlayerId,
        rating,
      })),
    };

    if (payload.ratings.length === 0) {
      setMessage("Preencha ao menos uma nota.");
      return;
    }

    const response = await fetch(`/api/matches/${match.id}/ratings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const payloadError = await response.json().catch(() => ({ error: "Erro ao salvar avaliacoes." }));
      setMessage(payloadError.error ?? "Erro ao salvar avaliacoes.");
      return;
    }

    setMessage("Avaliacoes salvas.");
  }

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="text-3xl font-bold text-emerald-950">Pos-jogo</h2>
        <p className="text-sm text-emerald-800">Registre gols, assistencias, gols sofridos e notas.</p>
      </section>

      <section className="card overflow-x-auto p-4">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-emerald-900">
              <th className="p-2">Jogador</th>
              <th className="p-2">Time</th>
              <th className="p-2">Gols</th>
              <th className="p-2">Assist.</th>
              <th className="p-2">Gols sofridos</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((participant) => (
              <tr key={participant.playerId} className="border-t border-emerald-100">
                <td className="p-2 font-medium">{participant.player.name}</td>
                <td className="p-2">{participant.team ?? "-"}</td>
                <td className="p-2">
                  <input
                    className="field-input max-w-20"
                    type="number"
                    min={0}
                    value={stats[participant.playerId]?.goals ?? 0}
                    onChange={(event) =>
                      updateStat(participant.playerId, "goals", Number(event.currentTarget.value))
                    }
                  />
                </td>
                <td className="p-2">
                  <input
                    className="field-input max-w-20"
                    type="number"
                    min={0}
                    value={stats[participant.playerId]?.assists ?? 0}
                    onChange={(event) =>
                      updateStat(participant.playerId, "assists", Number(event.currentTarget.value))
                    }
                  />
                </td>
                <td className="p-2">
                  <input
                    className="field-input max-w-20"
                    type="number"
                    min={0}
                    value={stats[participant.playerId]?.goalsConceded ?? 0}
                    onChange={(event) =>
                      updateStat(participant.playerId, "goalsConceded", Number(event.currentTarget.value))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button className="btn btn-primary mt-4" onClick={saveStats}>
          Salvar estatisticas
        </button>
      </section>

      <section className="card p-5">
        <h3 className="text-2xl font-bold text-emerald-950">Avaliacoes (1..5)</h3>
        <div className="mt-4 space-y-3">
          {participants
            .filter((participant) => participant.playerId !== currentPlayerId)
            .map((participant) => (
              <div
                key={participant.playerId}
                className="flex flex-col gap-2 rounded-xl border border-emerald-100 bg-white p-3 md:flex-row md:items-center md:justify-between"
              >
                <span className="font-medium text-emerald-900">{participant.player.name}</span>
                <StarRating
                  value={ratings[participant.playerId] ?? 0}
                  onChange={(value) =>
                    setRatings((prev) => ({
                      ...prev,
                      [participant.playerId]: value,
                    }))
                  }
                />
              </div>
            ))}
        </div>

        <button className="btn btn-accent mt-4" onClick={saveRatings}>
          Salvar avaliacoes
        </button>
      </section>

      {message ? <p className="text-sm font-medium text-emerald-900">{message}</p> : null}
    </div>
  );
}
