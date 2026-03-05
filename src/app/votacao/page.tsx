"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StarRating } from "@/components/star-rating";
import { formatDatePtBr, getDateSortValue } from "@/lib/date-format";

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
            participant.team === "A" &&
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
            participant.team === "B" &&
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

  function renderTeamGrid(title: string, participants: Participant[]) {
    const gridColumnsClass =
      "grid-cols-[minmax(0,1fr)_30px_30px_30px_132px] sm:grid-cols-[minmax(0,1fr)_52px_52px_52px_140px]";

    return (
      <div className="card p-4">
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
              {participants.map((participant) => (
                <li
                  key={participant.playerId}
                  className={`grid ${gridColumnsClass} items-center gap-1 rounded-lg border border-emerald-100 bg-white px-2 py-2 sm:gap-2 sm:px-3`}
                >
                  <span className="pr-1 text-xs font-medium leading-tight text-emerald-950 sm:text-sm">
                    {participant.player.name}
                  </span>
                  <span className="text-center text-xs text-emerald-900 sm:text-sm">{participant.goals}</span>
                  <span className="text-center text-xs text-emerald-900 sm:text-sm">{participant.assists}</span>
                  <span className="text-center text-xs text-emerald-900 sm:text-sm">{participant.goalsConceded}</span>
                  <div className="justify-self-center">
                    <StarRating
                      size="xs"
                      value={votes[participant.playerId] ?? 0}
                      onChange={(value) => updateVote(participant.playerId, value)}
                    />
                  </div>
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
        <h2 className="text-3xl font-bold text-emerald-950">Votacao</h2>
        <p className="text-sm text-emerald-800">
          Escolha seu nome, selecione a partida e vote em um ou mais jogadores. O salvamento e automatico.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
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

        {saveStatus === "saving" ? <p className="mt-3 text-sm text-amber-700">Salvando...</p> : null}
        {saveStatus === "saved" ? <p className="mt-3 text-sm text-emerald-800">{message}</p> : null}
        {saveStatus === "error" ? <p className="mt-3 text-sm text-red-700">{message}</p> : null}
      </section>

      {selectedRaterId && !selectedMatchId && matches.length === 0 ? (
        <section className="card p-4">
          <p className="text-sm font-medium text-emerald-900">
            Esse jogador nao tem partidas disponiveis para votacao.
          </p>
        </section>
      ) : null}

      {selectedRaterId && match ? (
        <>
          <section className="grid gap-4 xl:grid-cols-2">
            {renderTeamGrid(match.teamAName || "Time A", teamA)}
            {renderTeamGrid(match.teamBName || "Time B", teamB)}
          </section>
          {teamA.length === 0 && teamB.length === 0 ? (
            <section className="card p-4">
              <p className="text-sm font-medium text-emerald-900">
                Todos os jogadores dessa partida ja receberam sua nota.
              </p>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
