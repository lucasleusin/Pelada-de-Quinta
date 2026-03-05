"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDatePtBr, getDateSortValue } from "@/lib/date-format";

type Position = "GOLEIRO" | "ZAGUEIRO" | "MEIA" | "ATACANTE" | "OUTRO";

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
    position: Position;
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

function getPositionOrder(position: Position) {
  if (position === "GOLEIRO") return 0;
  if (position === "ZAGUEIRO") return 1;
  if (position === "MEIA") return 2;
  if (position === "ATACANTE") return 3;
  return 4;
}

function sortByPositionAndName<T extends { player: { name: string; position: Position } }>(list: T[]) {
  return [...list].sort((a, b) => {
    const byPosition = getPositionOrder(a.player.position) - getPositionOrder(b.player.position);
    if (byPosition !== 0) return byPosition;
    return a.player.name.localeCompare(b.player.name);
  });
}

function getPositionCode(position: Position) {
  if (position === "GOLEIRO") return "G";
  if (position === "ZAGUEIRO") return "Z";
  if (position === "MEIA") return "M";
  if (position === "ATACANTE") return "A";
  return "O";
}

function formatPlayerLabel(player: Participant["player"]) {
  return `${player.name} (${getPositionCode(player.position)})`;
}

function parseNullableScore(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : Math.min(99, Math.max(0, Math.trunc(parsed)));
}

function sanitizeTwoDigitInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 2);
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
  const [score, setScore] = useState<ScoreState>({ teamAScore: "", teamBScore: "" });
  const [statsDirty, setStatsDirty] = useState(false);
  const [scoreDirty, setScoreDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/matches?to=${getTodayIsoDate()}`)
      .then((res) => res.json())
      .then((payload: MatchSummary[]) => {
        const sorted = payload.sort(
          (a, b) => getDateSortValue(b.matchDate) - getDateSortValue(a.matchDate),
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

        for (const participant of payload.participants) {
          nextStats[participant.playerId] = {
            goals: participant.goals,
            assists: participant.assists,
            goalsConceded: participant.goalsConceded,
          };
        }

        setMatch(payload);
        setStats(nextStats);
        setScore({
          teamAScore: payload.teamAScore === null ? "" : String(payload.teamAScore),
          teamBScore: payload.teamBScore === null ? "" : String(payload.teamBScore),
        });
        setStatsDirty(false);
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
    setScore({ teamAScore: "", teamBScore: "" });
    setStatsDirty(false);
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

  useEffect(() => {
    if (!match) return;
    if (!scoreDirty && !statsDirty) return;

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

        setScoreDirty(false);
        setStatsDirty(false);
        setSaveStatus("saved");
        setMessage(`Salvo automaticamente em ${new Date().toLocaleTimeString("pt-BR")}.`);
      } catch (error) {
        setSaveStatus("error");
        setMessage(error instanceof Error ? error.message : "Falha ao salvar automaticamente.");
      }
    }, 700);

    return () => clearTimeout(timeout);
  }, [match, score, scoreDirty, stats, statsDirty]);

  const teamA = useMemo(
    () => sortByPositionAndName((match?.participants ?? []).filter((participant) => participant.team === "A")),
    [match],
  );
  const teamB = useMemo(
    () => sortByPositionAndName((match?.participants ?? []).filter((participant) => participant.team === "B")),
    [match],
  );

  const averageVoteByPlayerId = useMemo(() => {
    if (!match) return {};

    const grouped = new Map<string, { total: number; count: number }>();

    for (const rating of match.ratings) {
      const current = grouped.get(rating.ratedPlayerId) ?? { total: 0, count: 0 };
      grouped.set(rating.ratedPlayerId, {
        total: current.total + rating.rating,
        count: current.count + 1,
      });
    }

    const averages: Record<string, string> = {};

    for (const [playerId, value] of grouped.entries()) {
      const rounded = Math.round((value.total / value.count) * 10) / 10;
      averages[playerId] = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    }

    return averages;
  }, [match]);

  const goalsByTeam = useMemo(() => {
    let teamAGoals = 0;
    let teamBGoals = 0;

    for (const participant of match?.participants ?? []) {
      const goals = stats[participant.playerId]?.goals ?? 0;

      if (participant.team === "A") teamAGoals += goals;
      if (participant.team === "B") teamBGoals += goals;
    }

    return { teamAGoals, teamBGoals };
  }, [match, stats]);

  const missingGoals = useMemo(() => {
    const teamAScore = parseNullableScore(score.teamAScore);
    const teamBScore = parseNullableScore(score.teamBScore);

    return {
      teamA: teamAScore === null ? null : Math.max(0, teamAScore - goalsByTeam.teamAGoals),
      teamB: teamBScore === null ? null : Math.max(0, teamBScore - goalsByTeam.teamBGoals),
    };
  }, [goalsByTeam.teamAGoals, goalsByTeam.teamBGoals, score.teamAScore, score.teamBScore]);

  function updateScore(field: keyof ScoreState, value: string) {
    const sanitized = sanitizeTwoDigitInput(value);
    setScore((prev) => ({ ...prev, [field]: sanitized }));
    setScoreDirty(true);
  }

  function updateStat(playerId: string, field: keyof StatRow, value: string) {
    const sanitized = sanitizeTwoDigitInput(value);
    const parsed = sanitized === "" ? 0 : Number(sanitized);

    setStats((prev) => ({
      ...prev,
      [playerId]: {
        goals:
          field === "goals"
            ? Number.isNaN(parsed)
              ? 0
              : Math.min(99, Math.max(0, Math.trunc(parsed)))
            : prev[playerId]?.goals ?? 0,
        assists:
          field === "assists"
            ? Number.isNaN(parsed)
              ? 0
              : Math.min(99, Math.max(0, Math.trunc(parsed)))
            : prev[playerId]?.assists ?? 0,
        goalsConceded:
          field === "goalsConceded"
            ? Number.isNaN(parsed)
              ? 0
              : Math.min(99, Math.max(0, Math.trunc(parsed)))
            : prev[playerId]?.goalsConceded ?? 0,
      },
    }));
    setStatsDirty(true);
  }

  function renderTeamGrid(title: string, participants: Participant[]) {
    return (
      <div className="card p-4">
        <h3 className="text-2xl font-bold text-emerald-950">{title}</h3>
        {participants.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-800">Sem jogadores neste time.</p>
        ) : (
          <div className="mt-3">
            <div className="grid grid-cols-[minmax(0,1fr)_52px_52px_52px_140px] items-center gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-900">
              <span>Jogador</span>
              <span className="text-center">G</span>
              <span className="text-center">A</span>
              <span className="text-center">GS</span>
              <span className="text-center">Nota</span>
            </div>

            <ul className="mt-2 space-y-2">
              {participants.map((participant) => (
                <li
                  key={participant.playerId}
                  className="grid grid-cols-[minmax(0,1fr)_52px_52px_52px_140px] items-center gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2"
                >
                  <span className="truncate pr-1 text-sm font-medium text-emerald-950">{formatPlayerLabel(participant.player)}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    className="field-input h-8 w-12 justify-self-center px-1 text-center"
                    value={stats[participant.playerId]?.goals ?? 0}
                    onChange={(event) =>
                      updateStat(participant.playerId, "goals", event.currentTarget.value)
                    }
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    className="field-input h-8 w-12 justify-self-center px-1 text-center"
                    value={stats[participant.playerId]?.assists ?? 0}
                    onChange={(event) =>
                      updateStat(participant.playerId, "assists", event.currentTarget.value)
                    }
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    className="field-input h-8 w-12 justify-self-center px-1 text-center"
                    value={stats[participant.playerId]?.goalsConceded ?? 0}
                    onChange={(event) =>
                      updateStat(participant.playerId, "goalsConceded", event.currentTarget.value)
                    }
                  />
                  <span className="justify-self-center text-sm font-semibold text-emerald-900">
                    {averageVoteByPlayerId[participant.playerId] ?? "-"}
                  </span>
                </li>
              ))}
            </ul>
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
          Selecione a partida de hoje ou anteriores, ajuste stats e placar. A media dos votos aparece por jogador.
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
              {formatDatePtBr(item.matchDate)} - {item.startTime}
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
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  className="field-input"
                  value={score.teamAScore}
                  onChange={(event) => updateScore("teamAScore", event.currentTarget.value)}
                />
                {missingGoals.teamA !== null && missingGoals.teamA > 0 ? (
                  <p className="mt-1 text-xs font-semibold text-red-700">
                    {missingGoals.teamA} gols sem jogador
                  </p>
                ) : null}
              </label>
              <label>
                <span className="field-label">{match.teamBName || "Time B"}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  className="field-input"
                  value={score.teamBScore}
                  onChange={(event) => updateScore("teamBScore", event.currentTarget.value)}
                />
                {missingGoals.teamB !== null && missingGoals.teamB > 0 ? (
                  <p className="mt-1 text-xs font-semibold text-red-700">
                    {missingGoals.teamB} gols sem jogador
                  </p>
                ) : null}
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
