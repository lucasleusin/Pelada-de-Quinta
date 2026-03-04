"use client";

import { useEffect, useMemo, useState } from "react";
import { StarRating } from "@/components/star-rating";

type MatchSummary = {
  id: string;
  matchDate: string;
  location: string | null;
  startTime: string;
  teamAName: string;
  teamBName: string;
};

type Participant = {
  playerId: string;
  team: "A" | "B" | null;
  player: {
    id: string;
    name: string;
  };
  goals: number;
  assists: number;
  goalsConceded: number;
};

type MatchRating = {
  raterPlayerId: string;
  ratedPlayerId: string;
  rating: number;
};

type MatchDetails = MatchSummary & {
  participants: Participant[];
  ratings: MatchRating[];
};

type StatRow = {
  goals: number;
  assists: number;
  goalsConceded: number;
};

function getYesterdayIsoDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  today.setDate(today.getDate() - 1);
  return today.toISOString().slice(0, 10);
}

function sortByName<T extends { player: { name: string } }>(list: T[]) {
  return [...list].sort((a, b) => a.player.name.localeCompare(b.player.name));
}

export default function PartidasPassadasPage() {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [stats, setStats] = useState<Record<string, StatRow>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [statsDirty, setStatsDirty] = useState(false);
  const [ratingsDirty, setRatingsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/matches?to=${getYesterdayIsoDate()}`)
      .then((res) => res.json())
      .then((payload: MatchSummary[]) => {
        const sorted = payload.sort(
          (a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime(),
        );
        setMatches(sorted);
      })
      .catch(() => setMessage("Falha ao carregar partidas passadas."));
  }, []);

  useEffect(() => {
    if (!selectedMatchId) return;

    fetch(`/api/matches/${selectedMatchId}`)
      .then((res) => res.json())
      .then((payload: MatchDetails) => {
        const nextStats: Record<string, StatRow> = {};
        const nextRatings: Record<string, number> = {};

        for (const participant of payload.participants) {
          nextStats[participant.playerId] = {
            goals: participant.goals,
            assists: participant.assists,
            goalsConceded: participant.goalsConceded,
          };

          const selfRating = payload.ratings.find(
            (rating) =>
              rating.ratedPlayerId === participant.playerId && rating.raterPlayerId === participant.playerId,
          );
          const fallbackRating = payload.ratings.find(
            (rating) => rating.ratedPlayerId === participant.playerId,
          );
          nextRatings[participant.playerId] = selfRating?.rating ?? fallbackRating?.rating ?? 0;
        }

        setMatch(payload);
        setStats(nextStats);
        setRatings(nextRatings);
        setStatsDirty(false);
        setRatingsDirty(false);
        setSaveStatus("idle");
        setMessage("");
      })
      .catch(() => {
        setMessage("Falha ao carregar os dados da partida.");
        setSaveStatus("error");
      });
  }, [selectedMatchId]);

  function handleSelectMatch(nextMatchId: string) {
    setSelectedMatchId(nextMatchId);

    if (nextMatchId) return;

    setMatch(null);
    setStats({});
    setRatings({});
    setStatsDirty(false);
    setRatingsDirty(false);
    setSaveStatus("idle");
    setMessage("");
  }

  async function persistStats(selected: MatchDetails, currentStats: Record<string, StatRow>) {
    const response = await fetch(`/api/matches/${selected.id}/stats`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stats: selected.participants.map((participant) => ({
          playerId: participant.playerId,
          goals: currentStats[participant.playerId]?.goals ?? 0,
          assists: currentStats[participant.playerId]?.assists ?? 0,
          goalsConceded: currentStats[participant.playerId]?.goalsConceded ?? 0,
        })),
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Erro ao salvar estatisticas." }));
      throw new Error(payload.error ?? "Erro ao salvar estatisticas.");
    }
  }

  async function persistRatings(selected: MatchDetails, currentRatings: Record<string, number>) {
    const response = await fetch(`/api/matches/${selected.id}/ratings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ratings: selected.participants.map((participant) => ({
          raterPlayerId: participant.playerId,
          ratedPlayerId: participant.playerId,
          rating: currentRatings[participant.playerId] ?? 0,
        })),
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Erro ao salvar avaliacoes." }));
      throw new Error(payload.error ?? "Erro ao salvar avaliacoes.");
    }
  }

  useEffect(() => {
    if (!match) return;
    if (!statsDirty && !ratingsDirty) return;

    const timeout = setTimeout(async () => {
      setSaveStatus("saving");

      try {
        if (statsDirty) {
          await persistStats(match, stats);
        }

        if (ratingsDirty) {
          await persistRatings(match, ratings);
        }

        setStatsDirty(false);
        setRatingsDirty(false);
        setSaveStatus("saved");
        setMessage(`Salvo automaticamente em ${new Date().toLocaleTimeString("pt-BR")}.`);
      } catch (error) {
        setSaveStatus("error");
        setMessage(error instanceof Error ? error.message : "Falha ao salvar automaticamente.");
      }
    }, 700);

    return () => clearTimeout(timeout);
  }, [match, ratings, ratingsDirty, stats, statsDirty]);

  const teamA = useMemo(
    () => sortByName((match?.participants ?? []).filter((participant) => participant.team === "A")),
    [match],
  );
  const teamB = useMemo(
    () => sortByName((match?.participants ?? []).filter((participant) => participant.team === "B")),
    [match],
  );

  function updateStat(playerId: string, field: keyof StatRow, value: number) {
    setStats((prev) => ({
      ...prev,
      [playerId]: {
        goals: prev[playerId]?.goals ?? 0,
        assists: prev[playerId]?.assists ?? 0,
        goalsConceded: prev[playerId]?.goalsConceded ?? 0,
        [field]: Number.isNaN(value) ? 0 : Math.max(0, value),
      },
    }));
    setStatsDirty(true);
  }

  function updateRating(playerId: string, rating: number) {
    setRatings((prev) => ({
      ...prev,
      [playerId]: rating,
    }));
    setRatingsDirty(true);
  }

  function renderPlayerCard(participant: Participant) {
    return (
      <li key={participant.playerId} className="rounded-xl border border-emerald-100 bg-white p-3">
        <p className="font-semibold text-emerald-950">{participant.player.name}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <label>
            <span className="field-label">Gols</span>
            <input
              type="number"
              min={0}
              className="field-input"
              value={stats[participant.playerId]?.goals ?? 0}
              onChange={(event) =>
                updateStat(participant.playerId, "goals", Number(event.currentTarget.value))
              }
            />
          </label>
          <label>
            <span className="field-label">Assistencias</span>
            <input
              type="number"
              min={0}
              className="field-input"
              value={stats[participant.playerId]?.assists ?? 0}
              onChange={(event) =>
                updateStat(participant.playerId, "assists", Number(event.currentTarget.value))
              }
            />
          </label>
          <label>
            <span className="field-label">Gols sofridos</span>
            <input
              type="number"
              min={0}
              className="field-input"
              value={stats[participant.playerId]?.goalsConceded ?? 0}
              onChange={(event) =>
                updateStat(participant.playerId, "goalsConceded", Number(event.currentTarget.value))
              }
            />
          </label>
        </div>

        <div className="mt-3">
          <p className="field-label mb-1">Nota</p>
          <StarRating
            value={ratings[participant.playerId] ?? 0}
            onChange={(value) => updateRating(participant.playerId, value)}
          />
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h2 className="text-3xl font-bold text-emerald-950">Partidas Passadas</h2>
        <p className="text-sm text-emerald-800">
          Selecione a partida, ajuste stats e notas. O salvamento e automatico.
        </p>

        <label className="field-label mt-4" htmlFor="past-match-select">
          Escolha a partida
        </label>
        <select
          id="past-match-select"
          className="field-input max-w-xl"
          value={selectedMatchId}
          onChange={(event) => handleSelectMatch(event.currentTarget.value)}
        >
          <option value="">Selecione...</option>
          {matches.map((item) => (
            <option key={item.id} value={item.id}>
              {new Date(item.matchDate).toLocaleDateString("pt-BR")} - {item.startTime}
              {item.location ? ` - ${item.location}` : ""}
            </option>
          ))}
        </select>

        {saveStatus === "saving" ? <p className="mt-3 text-sm text-amber-700">Salvando...</p> : null}
        {saveStatus === "saved" ? <p className="mt-3 text-sm text-emerald-800">{message}</p> : null}
        {saveStatus === "error" ? <p className="mt-3 text-sm text-red-700">{message}</p> : null}
      </section>

      {match ? (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-2xl font-bold text-emerald-950">{match.teamAName || "Time A"}</h3>
            {teamA.length === 0 ? (
              <p className="mt-2 text-sm text-emerald-800">Sem jogadores no Time A.</p>
            ) : (
              <ul className="mt-3 space-y-3">{teamA.map((participant) => renderPlayerCard(participant))}</ul>
            )}
          </div>

          <div className="card p-4">
            <h3 className="text-2xl font-bold text-emerald-950">{match.teamBName || "Time B"}</h3>
            {teamB.length === 0 ? (
              <p className="mt-2 text-sm text-emerald-800">Sem jogadores no Time B.</p>
            ) : (
              <ul className="mt-3 space-y-3">{teamB.map((participant) => renderPlayerCard(participant))}</ul>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
