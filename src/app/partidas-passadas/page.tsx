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
  teamAScore: number | null;
  teamBScore: number | null;
  participants: Participant[];
  ratings: MatchRating[];
};

type StatRow = {
  goals: number;
  assists: number;
  goalsConceded: number;
};

type ScoreState = {
  teamAScore: string;
  teamBScore: string;
};

function getTodayIsoDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().slice(0, 10);
}

function sortByName<T extends { player: { name: string } }>(list: T[]) {
  return [...list].sort((a, b) => a.player.name.localeCompare(b.player.name));
}

function parseNullableScore(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : Math.min(99, Math.max(0, Math.trunc(parsed)));
}

function validateGoalsVsScore(
  participants: Participant[],
  stats: Record<string, StatRow>,
  score: ScoreState,
): string | null {
  const teamAScore = parseNullableScore(score.teamAScore);
  const teamBScore = parseNullableScore(score.teamBScore);

  let teamAGoals = 0;
  let teamBGoals = 0;

  for (const participant of participants) {
    const goals = stats[participant.playerId]?.goals ?? 0;

    if (participant.team === "A") {
      teamAGoals += goals;
    }

    if (participant.team === "B") {
      teamBGoals += goals;
    }
  }

  if (teamAScore === null && teamAGoals > 0) {
    return "Informe o placar do Time A antes de salvar gols.";
  }

  if (teamBScore === null && teamBGoals > 0) {
    return "Informe o placar do Time B antes de salvar gols.";
  }

  if (teamAScore !== null && teamAGoals > teamAScore) {
    return "Os gols dos jogadores do Time A nao podem ultrapassar o placar do Time A.";
  }

  if (teamBScore !== null && teamBGoals > teamBScore) {
    return "Os gols dos jogadores do Time B nao podem ultrapassar o placar do Time B.";
  }

  return null;
}

export default function PartidasPassadasPage() {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [stats, setStats] = useState<Record<string, StatRow>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [score, setScore] = useState<ScoreState>({ teamAScore: "", teamBScore: "" });
  const [statsDirty, setStatsDirty] = useState(false);
  const [ratingsDirty, setRatingsDirty] = useState(false);
  const [scoreDirty, setScoreDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/matches?to=${getTodayIsoDate()}`)
      .then((res) => res.json())
      .then((payload: MatchSummary[]) => {
        const sorted = payload.sort(
          (a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime(),
        );
        setMatches(sorted);
      })
      .catch(() => setMessage("Falha ao carregar partidas."));
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
        setScore({
          teamAScore: payload.teamAScore === null ? "" : String(payload.teamAScore),
          teamBScore: payload.teamBScore === null ? "" : String(payload.teamBScore),
        });
        setStatsDirty(false);
        setRatingsDirty(false);
        setScoreDirty(false);
        setSaveStatus("idle");
        setMessage("");
      })
      .catch(() => {
        setMessage("Falha ao carregar os dados da partida.");
        setSaveStatus("error");
      });
  }, [selectedMatchId]);

  function resetSelection() {
    setMatch(null);
    setStats({});
    setRatings({});
    setScore({ teamAScore: "", teamBScore: "" });
    setStatsDirty(false);
    setRatingsDirty(false);
    setScoreDirty(false);
    setSaveStatus("idle");
    setMessage("");
  }

  function handleSelectMatch(nextMatchId: string) {
    setSelectedMatchId(nextMatchId);

    if (!nextMatchId) {
      resetSelection();
    }
  }

  async function persistScore(selected: MatchDetails, currentScore: ScoreState) {
    const response = await fetch(`/api/matches/${selected.id}/score`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        teamAScore: parseNullableScore(currentScore.teamAScore),
        teamBScore: parseNullableScore(currentScore.teamBScore),
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Erro ao salvar placar." }));
      throw new Error(payload.error ?? "Erro ao salvar placar.");
    }
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
    const ratingsPayload = selected.participants
      .map((participant) => ({
        raterPlayerId: participant.playerId,
        ratedPlayerId: participant.playerId,
        rating: currentRatings[participant.playerId] ?? 0,
      }))
      .filter((item) => item.rating >= 1 && item.rating <= 5);

    if (ratingsPayload.length === 0) {
      return;
    }

    const response = await fetch(`/api/matches/${selected.id}/ratings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ratings: ratingsPayload,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Erro ao salvar avaliacoes." }));
      throw new Error(payload.error ?? "Erro ao salvar avaliacoes.");
    }
  }

  useEffect(() => {
    if (!match) return;
    if (!scoreDirty && !statsDirty && !ratingsDirty) return;

    const timeout = setTimeout(async () => {
      setSaveStatus("saving");

      const validationError = validateGoalsVsScore(match.participants, stats, score);
      if (validationError) {
        setSaveStatus("error");
        setMessage(validationError);
        return;
      }

      try {
        if (scoreDirty) {
          await persistScore(match, score);
        }

        if (statsDirty) {
          await persistStats(match, stats);
        }

        if (ratingsDirty) {
          await persistRatings(match, ratings);
        }

        setScoreDirty(false);
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
  }, [match, ratings, ratingsDirty, score, scoreDirty, stats, statsDirty]);

  const teamA = useMemo(
    () => sortByName((match?.participants ?? []).filter((participant) => participant.team === "A")),
    [match],
  );
  const teamB = useMemo(
    () => sortByName((match?.participants ?? []).filter((participant) => participant.team === "B")),
    [match],
  );

  function updateScore(field: keyof ScoreState, value: string) {
    setScore((prev) => ({ ...prev, [field]: value }));
    setScoreDirty(true);
  }

  function updateStat(playerId: string, field: keyof StatRow, value: number) {
    setStats((prev) => ({
      ...prev,
      [playerId]: {
        goals:
          field === "goals"
            ? Number.isNaN(value)
              ? 0
              : Math.min(99, Math.max(0, Math.trunc(value)))
            : prev[playerId]?.goals ?? 0,
        assists:
          field === "assists"
            ? Number.isNaN(value)
              ? 0
              : Math.min(99, Math.max(0, Math.trunc(value)))
            : prev[playerId]?.assists ?? 0,
        goalsConceded:
          field === "goalsConceded"
            ? Number.isNaN(value)
              ? 0
              : Math.min(99, Math.max(0, Math.trunc(value)))
            : prev[playerId]?.goalsConceded ?? 0,
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

  function renderTeamGrid(title: string, participants: Participant[]) {
    return (
      <div className="card p-4">
        <h3 className="text-2xl font-bold text-emerald-950">{title}</h3>
        {participants.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-800">Sem jogadores neste time.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <div className="min-w-[820px]">
              <div className="grid grid-cols-[minmax(180px,1.6fr)_90px_120px_130px_260px] gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-900">
                <span>Jogador</span>
                <span>G</span>
                <span>A</span>
                <span>GS</span>
                <span>Nota</span>
              </div>

              <ul className="mt-2 space-y-2">
                {participants.map((participant) => (
                  <li
                    key={participant.playerId}
                    className="grid grid-cols-[minmax(180px,1.6fr)_90px_120px_130px_260px] items-center gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2"
                  >
                    <span className="text-sm font-medium text-emerald-950">{participant.player.name}</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      className="field-input h-9"
                      value={stats[participant.playerId]?.goals ?? 0}
                      onChange={(event) =>
                        updateStat(participant.playerId, "goals", Number(event.currentTarget.value))
                      }
                    />
                    <input
                      type="number"
                      min={0}
                      max={99}
                      className="field-input h-9"
                      value={stats[participant.playerId]?.assists ?? 0}
                      onChange={(event) =>
                        updateStat(participant.playerId, "assists", Number(event.currentTarget.value))
                      }
                    />
                    <input
                      type="number"
                      min={0}
                      max={99}
                      className="field-input h-9"
                      value={stats[participant.playerId]?.goalsConceded ?? 0}
                      onChange={(event) =>
                        updateStat(participant.playerId, "goalsConceded", Number(event.currentTarget.value))
                      }
                    />
                    <StarRating
                      size="sm"
                      value={ratings[participant.playerId] ?? 0}
                      onChange={(value) => updateRating(participant.playerId, value)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h2 className="text-3xl font-bold text-emerald-950">Partidas Passadas</h2>
        <p className="text-sm text-emerald-800">
          Selecione a partida de hoje ou anteriores, ajuste stats, notas e placar. O salvamento e automatico.
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
        <>
          <section className="card p-4">
            <h3 className="text-2xl font-bold text-emerald-950">Placar</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label>
                <span className="field-label">{match.teamAName || "Time A"}</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  className="field-input"
                  value={score.teamAScore}
                  onChange={(event) => updateScore("teamAScore", event.currentTarget.value)}
                />
              </label>
              <label>
                <span className="field-label">{match.teamBName || "Time B"}</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  className="field-input"
                  value={score.teamBScore}
                  onChange={(event) => updateScore("teamBScore", event.currentTarget.value)}
                />
              </label>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            {renderTeamGrid(match.teamAName || "Time A", teamA)}
            {renderTeamGrid(match.teamBName || "Time B", teamB)}
          </section>
        </>
      ) : null}
    </div>
  );
}
