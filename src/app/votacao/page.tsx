"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HeroBlock, PageShell, SectionShell, StatusNote } from "@/components/layout/primitives";
import { StarRating } from "@/components/star-rating";
import { formatDatePtBr, getDateSortValue } from "@/lib/date-format";
import { getPrimaryTeam, type TeamCode } from "@/lib/team-utils";

type CurrentUser = {
  id: string;
  status: "PENDING_VERIFICATION" | "PENDING_APPROVAL" | "ACTIVE" | "DISABLED" | "REJECTED";
  playerId: string | null;
  mustChangePassword?: boolean;
};

type MatchSummary = {
  id: string;
  matchDate: string;
  location: string | null;
  startTime: string;
  teamAName: string;
  teamBName: string;
  teamAScore: number | null;
  teamBScore: number | null;
};

type Participant = {
  playerId: string;
  teams: TeamCode[];
  primaryTeam: TeamCode | null;
  player: {
    id: string;
    name: string;
    nickname?: string | null;
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

function pendingMessage(status: CurrentUser["status"]) {
  if (status === "PENDING_VERIFICATION") return "Confirme seu email para liberar sua conta.";
  if (status === "PENDING_APPROVAL") return "Seu cadastro esta aguardando aprovacao do administrador.";
  if (status === "REJECTED") return "Seu cadastro foi rejeitado. Fale com o administrador.";
  if (status === "DISABLED") return "Seu acesso foi removido. Fale com o administrador.";
  return "Sua conta ainda nao esta pronta para uso.";
}

function playerLabel(participant: Participant) {
  return participant.player.nickname ?? participant.player.name;
}

function sortByName<T extends Participant>(list: T[]) {
  return [...list].sort((a, b) => playerLabel(a).localeCompare(playerLabel(b)));
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
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
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

  const activePlayerId = currentUser?.status === "ACTIVE" ? currentUser.playerId : null;

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Nao foi possivel carregar a sessao atual.");
        }

        const payload = (await response.json()) as CurrentUser;
        setCurrentUser(payload);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Falha ao carregar sua sessao."));
  }, []);

  useEffect(() => {
    if (!activePlayerId) return;

    fetch(`/api/matches?to=${getTodayIsoDate()}&playerId=me`, { cache: "no-store" })
      .then(async (matchesRes) => {
        if (!matchesRes.ok) {
          const payload = await matchesRes.json().catch(() => ({ error: "Falha ao carregar partidas da votacao." }));
          throw new Error(payload.error ?? "Falha ao carregar partidas da votacao.");
        }

        const matchesPayload = (await matchesRes.json()) as MatchSummary[];
        const latestMatches = matchesPayload
          .sort((a, b) => getDateSortValue(b.matchDate) - getDateSortValue(a.matchDate))
          .slice(0, 3);

        setMatches(latestMatches);
        setSelectedMatchId((current) =>
          current && latestMatches.some((matchItem) => matchItem.id === current)
            ? current
            : latestMatches[0]?.id ?? "",
        );
      })
      .catch((error) => {
        setMatches([]);
        setMessage(error instanceof Error ? error.message : "Falha ao carregar partidas da votacao.");
      });
  }, [activePlayerId]);

  useEffect(() => {
    if (!selectedMatchId || !activePlayerId) return;

    fetch(`/api/matches/${selectedMatchId}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({ error: "Falha ao carregar detalhes da partida." }));
          throw new Error(payload.error ?? "Falha ao carregar detalhes da partida.");
        }

        const payload = (await res.json()) as MatchDetails;
        setMatch(payload);
        setVotes(getVotesFromRatings(payload.ratings, activePlayerId));
        setDirtyVoteIds([]);
        setSaveStatus("idle");
        setMessage("");
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "Falha ao carregar detalhes da partida.");
        setSaveStatus("error");
      });
  }, [activePlayerId, selectedMatchId]);

  function handleSelectMatch(nextMatchId: string) {
    setSelectedMatchId(nextMatchId);
    resetSelectedMatchState();
  }

  useEffect(() => {
    if (!activePlayerId || !selectedMatchId || !match || dirtyVoteIds.length === 0) return;

    const timeout = setTimeout(async () => {
      setSaveStatus("saving");

      const ratings = dirtyVoteIds
        .map((ratedPlayerId) => ({
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
  }, [activePlayerId, dirtyVoteIds, match, selectedMatchId, votes]);

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
            getPrimaryTeam(participant.primaryTeam, participant.teams) === "A" &&
            participant.playerId !== activePlayerId &&
            !alreadyRatedIds.has(participant.playerId),
        ),
      ),
    [activePlayerId, alreadyRatedIds, match],
  );
  const teamB = useMemo(
    () =>
      sortByName(
        (match?.participants ?? []).filter(
          (participant) =>
            getPrimaryTeam(participant.primaryTeam, participant.teams) === "B" &&
            participant.playerId !== activePlayerId &&
            !alreadyRatedIds.has(participant.playerId),
        ),
      ),
    [activePlayerId, alreadyRatedIds, match],
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
            <div className={`grid ${gridColumnsClass} items-center gap-1 rounded-lg bg-emerald-100 px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-900 sm:gap-2 sm:px-3 sm:text-xs`}>
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
                  <li key={`${participant.playerId}-${team}`} className={`grid ${gridColumnsClass} items-center gap-1 rounded-lg border border-emerald-100 bg-white px-2 py-2 sm:gap-2 sm:px-3`}>
                    <span className="pr-1 text-xs font-medium leading-tight text-emerald-950 sm:text-sm">{playerLabel(participant)}</span>
                    <span className="text-center text-xs text-emerald-900 sm:text-sm">{teamStats.goals}</span>
                    <span className="text-center text-xs text-emerald-900 sm:text-sm">{teamStats.assists}</span>
                    <span className="text-center text-xs text-emerald-900 sm:text-sm">{teamStats.goalsConceded}</span>
                    <div className="justify-self-center">
                      <StarRating size="xs" value={votes[participant.playerId] ?? 0} onChange={(value) => updateVote(participant.playerId, value)} />
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
        <p className="text-sm text-emerald-800">As partidas ja aparecem filtradas para o atleta logado, com a mais recente pre-selecionada.</p>

        {!currentUser ? <StatusNote className="mt-4" tone="warning">Carregando sua conta...</StatusNote> : null}
        {currentUser && !activePlayerId ? <StatusNote className="mt-4" tone="warning">{pendingMessage(currentUser.status)}</StatusNote> : null}

        {activePlayerId ? (
          <div className="mt-4 space-y-4">
            <div>
              <span className="field-label">Partida</span>
              <div className="mt-2 space-y-2">
                {matches.map((matchItem) => {
                  const isActive = selectedMatchId === matchItem.id;

                  return (
                    <button
                      key={matchItem.id}
                      type="button"
                      onClick={() => handleSelectMatch(matchItem.id)}
                      className={`block w-full rounded-2xl border px-4 py-3 text-left transition ${
                        isActive
                          ? "border-emerald-500 bg-emerald-950 text-white shadow-lg shadow-emerald-950/20"
                          : "border-emerald-200 bg-white text-emerald-950 hover:border-emerald-300 hover:bg-emerald-50"
                      }`}
                    >
                      <p className={`text-base font-semibold sm:text-lg ${isActive ? "text-white" : "text-emerald-950"}`}>
                        {formatDatePtBr(matchItem.matchDate)} - {matchItem.teamAName || "Time A"} {matchItem.teamAScore ?? "-"} x {matchItem.teamBScore ?? "-"} {matchItem.teamBName || "Time B"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {saveStatus === "saving" ? <StatusNote className="mt-3" tone="warning">Salvando...</StatusNote> : null}
        {saveStatus === "saved" ? <StatusNote className="mt-3" tone="success">{message}</StatusNote> : null}
        {saveStatus === "error" ? <StatusNote className="mt-3" tone="error">{message}</StatusNote> : null}
      </HeroBlock>

      {activePlayerId && matches.length === 0 ? (
        <SectionShell className="p-4">
          <p className="empty-state text-sm">Nao existem partidas disponiveis para votacao para este atleta.</p>
        </SectionShell>
      ) : null}

      {activePlayerId && selectedMatchId && match ? (
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
