"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionBar,
  HeroBlock,
  PageShell,
  SectionShell,
  StatusNote,
} from "@/components/layout/primitives";
import { StarRating } from "@/components/star-rating";
import { formatDatePtBr, getDateSortValue } from "@/lib/date-format";
import { hasTeam, type TeamCode } from "@/lib/team-utils";

type Player = {
  id: string;
  name: string;
};

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
  teams: TeamCode[];
  player: {
    id: string;
    name: string;
  };
  teamAGoals: number;
  teamAAssists: number;
  teamAGoalsConceded: number;
  teamBGoals: number;
  teamBAssists: number;
  teamBGoalsConceded: number;
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

function getTodayIsoDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().slice(0, 10);
}

function sortByName<T extends { player: { name: string } }>(list: T[]) {
  return [...list].sort((a, b) => a.player.name.localeCompare(b.player.name));
}

function getVotesFromRatings(ratings: MatchRating[], raterPlayerId: string) {
  const map: Record<string, number> = {};

  for (const rating of ratings) {
    if (rating.raterPlayerId !== raterPlayerId) continue;
    map[rating.ratedPlayerId] = rating.rating;
  }

  return map;
}

function getParticipantTeamStats(participant: Participant, team: TeamCode) {
  if (team === "A") {
    return {
      goals: participant.teamAGoals,
      assists: participant.teamAAssists,
      goalsConceded: participant.teamAGoalsConceded,
    };
  }

  return {
    goals: participant.teamBGoals,
    assists: participant.teamBAssists,
    goalsConceded: participant.teamBGoalsConceded,
  };
}

export default function VotacaoPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [selectedRaterId, setSelectedRaterId] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [dirtyVoteIds, setDirtyVoteIds] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  const resetSelectedMatchState = useCallback(() => {
    setMatch(null);
    setVotes({});
    setDirtyVoteIds([]);
    setSaveStatus("idle");
    setMessage("");
  }, []);

  useEffect(() => {
    fetch("/api/players?active=true")
      .then(async (playersRes) => {
        const playersPayload = ((await playersRes.json()) as Player[]).sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        setPlayers(playersPayload);
      })
      .catch(() => setMessage("Falha ao carregar jogadores da votacao."));
  }, []);

  useEffect(() => {
    if (!selectedRaterId) return;

    fetch(`/api/matches?to=${getTodayIsoDate()}&playerId=${selectedRaterId}`)
      .then((res) => res.json())
      .then((payload: MatchSummary[]) => {
        const sortedMatches = payload.sort(
          (a, b) => getDateSortValue(b.matchDate) - getDateSortValue(a.matchDate),
        );

        setMatches(sortedMatches);
      })
      .catch(() => {
        setMatches([]);
        setMessage("Falha ao carregar partidas desse jogador.");
      });
  }, [selectedRaterId]);

  useEffect(() => {
    if (!selectedMatchId) return;

    fetch(`/api/matches/${selectedMatchId}`)
      .then((res) => res.json())
      .then((payload: MatchDetails) => {
        setMatch(payload);
        setVotes(selectedRaterId ? getVotesFromRatings(payload.ratings, selectedRaterId) : {});
        setDirtyVoteIds([]);
        setSaveStatus("idle");
        setMessage("");
      })
      .catch(() => {
        setMessage("Falha ao carregar detalhes da partida.");
        setSaveStatus("error");
      });
  }, [selectedMatchId, selectedRaterId]);

  function handleSelectMatch(nextMatchId: string) {
    setSelectedMatchId(nextMatchId);

    if (!nextMatchId) {
      resetSelectedMatchState();
    }
  }

  useEffect(() => {
    if (!selectedRaterId || !selectedMatchId) return;
    if (!match) return;
    if (dirtyVoteIds.length === 0) return;

    const timeout = setTimeout(async () => {
      setSaveStatus("saving");

      const ratings = dirtyVoteIds
        .map((ratedPlayerId) => ({
          raterPlayerId: selectedRaterId,
          ratedPlayerId,
          rating: votes[ratedPlayerId],
        }))
        .filter((item) => item.rating >= 1 && item.rating <= 5);

      if (ratings.length === 0) {
        setDirtyVoteIds([]);
        setSaveStatus("idle");
        return;
      }

      const response = await fetch(`/api/matches/${selectedMatchId}/ratings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ratings }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Erro ao salvar votos." }));
        setMessage(payload.error ?? "Erro ao salvar votos.");
        setSaveStatus("error");
        return;
      }

      setDirtyVoteIds([]);
      setSaveStatus("saved");
      setMessage(`Votos salvos automaticamente em ${new Date().toLocaleTimeString("pt-BR")}.`);
    }, 700);

    return () => clearTimeout(timeout);
  }, [dirtyVoteIds, match, selectedMatchId, selectedRaterId, votes]);

  const alreadyRatedIds = useMemo(() => {
    const ids = new Set<string>();

    for (const [ratedPlayerId, rating] of Object.entries(votes)) {
      if (rating >= 1 && rating <= 5) {
        ids.add(ratedPlayerId);
      }
    }

    return ids;
  }, [votes]);

  const teamA = useMemo(
    () =>
      sortByName(
        (match?.participants ?? []).filter(
          (participant) =>
            hasTeam(participant.teams, "A") &&
            participant.playerId !== selectedRaterId &&
            !alreadyRatedIds.has(participant.playerId),
        ),
      ),
    [alreadyRatedIds, match, selectedRaterId],
  );
  const teamB = useMemo(
    () =>
      sortByName(
        (match?.participants ?? []).filter(
          (participant) =>
            hasTeam(participant.teams, "B") &&
            participant.playerId !== selectedRaterId &&
            !alreadyRatedIds.has(participant.playerId),
        ),
      ),
    [alreadyRatedIds, match, selectedRaterId],
  );

  function updateVote(ratedPlayerId: string, rating: number) {
    setVotes((prev) => ({
      ...prev,
      [ratedPlayerId]: rating,
    }));

    setDirtyVoteIds((prev) => (prev.includes(ratedPlayerId) ? prev : [...prev, ratedPlayerId]));
  }

  function renderTeamGrid(title: string, team: TeamCode, participants: Participant[]) {
    const gridColumnsClass =
      "grid-cols-[minmax(0,1fr)_30px_30px_30px_132px] sm:grid-cols-[minmax(0,1fr)_52px_52px_52px_140px]";

    return (
      <SectionShell className="p-4">
        <h3 className="text-2xl font-bold text-emerald-950">{title}</h3>
        {participants.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-800">Sem jogadores neste time.</p>
        ) : (
          <div className="mt-3">
            <div
              className={`grid ${gridColumnsClass} items-center gap-1 rounded-lg bg-emerald-100 px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-900 sm:gap-2 sm:px-3 sm:text-xs`}
            >
              <span>Jogador</span>
              <span className="text-center">G</span>
              <span className="text-center">A</span>
              <span className="text-center">GS</span>
              <span className="text-center">Voto</span>
            </div>

            <ul className="mt-2 space-y-2">
              {participants.map((participant) => {
                const teamStats = getParticipantTeamStats(participant, team);

                return (
                  <li
                    key={`${participant.playerId}-${team}`}
                    className={`grid ${gridColumnsClass} items-center gap-1 rounded-lg border border-emerald-100 bg-white px-2 py-2 sm:gap-2 sm:px-3`}
                  >
                    <span className="pr-1 text-xs font-medium leading-tight text-emerald-950 sm:text-sm">
                      {participant.player.name}
                    </span>
                    <span className="text-center text-xs text-emerald-900 sm:text-sm">{teamStats.goals}</span>
                    <span className="text-center text-xs text-emerald-900 sm:text-sm">{teamStats.assists}</span>
                    <span className="text-center text-xs text-emerald-900 sm:text-sm">{teamStats.goalsConceded}</span>
                    <div className="justify-self-center">
                      <StarRating
                        size="xs"
                        value={votes[participant.playerId] ?? 0}
                        onChange={(value) => updateVote(participant.playerId, value)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </SectionShell>
    );
  }

  return (
    <PageShell>
      <HeroBlock className="p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Avaliacao</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Votacao</h2>
        <p className="text-sm text-emerald-800">
          Escolha seu nome, selecione a partida e vote em um ou mais jogadores. O salvamento e automatico.
        </p>

        <ActionBar className="mt-4 p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="field-label">Quem esta votando?</span>
              <select
                className="field-input"
                value={selectedRaterId}
                onChange={(event) => {
                  const nextRaterId = event.currentTarget.value;
                  setSelectedRaterId(nextRaterId);
                  setMatches([]);
                  setSelectedMatchId("");
                  resetSelectedMatchState();
                  setSaveStatus("idle");
                  setMessage("");
                }}
              >
                <option value="">Selecione...</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="field-label">Partida</span>
              <select
                className="field-input"
                value={selectedMatchId}
                onChange={(event) => handleSelectMatch(event.currentTarget.value)}
                disabled={!selectedRaterId}
              >
                <option value="">Selecione...</option>
                {matches.map((matchItem) => (
                  <option key={matchItem.id} value={matchItem.id}>
                    {formatDatePtBr(matchItem.matchDate)} - {matchItem.startTime}
                    {matchItem.location ? ` - ${matchItem.location}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </ActionBar>

        {saveStatus === "saving" ? <StatusNote className="mt-3" tone="warning">Salvando...</StatusNote> : null}
        {saveStatus === "saved" ? <StatusNote className="mt-3" tone="success">{message}</StatusNote> : null}
        {saveStatus === "error" ? <StatusNote className="mt-3" tone="error">{message}</StatusNote> : null}
      </HeroBlock>

      {selectedRaterId && !selectedMatchId && matches.length === 0 ? (
        <SectionShell className="p-4">
          <p className="empty-state text-sm">Esse jogador nao tem partidas disponiveis para votacao.</p>
        </SectionShell>
      ) : null}

      {selectedRaterId && match ? (
        <>
          <section className="grid gap-4 xl:grid-cols-2">
            {renderTeamGrid(match.teamAName || "Time A", "A", teamA)}
            {renderTeamGrid(match.teamBName || "Time B", "B", teamB)}
          </section>
          {teamA.length === 0 && teamB.length === 0 ? (
            <SectionShell className="p-4">
              <p className="empty-state text-sm">Todos os jogadores dessa partida ja receberam sua nota.</p>
            </SectionShell>
          ) : null}
        </>
      ) : null}
    </PageShell>
  );
}

