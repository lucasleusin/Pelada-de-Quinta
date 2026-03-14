"use client";

import { useEffect, useMemo, useState } from "react";
import { HeroBlock, PageShell, SectionShell, StatusNote } from "@/components/layout/primitives";
import { formatDatePtBr, getDateSortValue } from "@/lib/date-format";
import { hasTeam, type TeamCode } from "@/lib/team-utils";

type CurrentUser = {
  id: string;
  status: "PENDING_VERIFICATION" | "PENDING_APPROVAL" | "ACTIVE" | "REJECTED";
  playerId: string | null;
};

type Position = "GOLEIRO" | "ZAGUEIRO" | "MEIA" | "ATACANTE" | "OUTRO";

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
  player: {
    id: string;
    name: string;
    nickname?: string | null;
    position: Position;
  };
  teamAGoals: number;
  teamAAssists: number;
  teamAGoalsConceded: number;
  teamBGoals: number;
  teamBAssists: number;
  teamBGoalsConceded: number;
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

function getPositionOrder(position: Position) {
  if (position === "GOLEIRO") return 0;
  if (position === "ZAGUEIRO") return 1;
  if (position === "MEIA") return 2;
  if (position === "ATACANTE") return 3;
  return 4;
}

function playerLabel(player: Participant["player"]) {
  return player.nickname ?? player.name;
}

function getPositionCode(position: Position) {
  if (position === "GOLEIRO") return "G";
  if (position === "ZAGUEIRO") return "Z";
  if (position === "MEIA") return "M";
  if (position === "ATACANTE") return "A";
  return "O";
}

function formatPlayerLabel(player: Participant["player"]) {
  return `${playerLabel(player)} (${getPositionCode(player.position)})`;
}

function sortByPositionAndName<T extends { player: Participant["player"] }>(list: T[]) {
  return [...list].sort((a, b) => {
    const byPosition = getPositionOrder(a.player.position) - getPositionOrder(b.player.position);
    if (byPosition !== 0) return byPosition;
    return playerLabel(a.player).localeCompare(playerLabel(b.player));
  });
}

function pendingMessage(status: CurrentUser["status"]) {
  if (status === "PENDING_VERIFICATION") return "Confirme seu email para liberar sua conta.";
  if (status === "PENDING_APPROVAL") return "Seu cadastro esta aguardando aprovacao do administrador.";
  if (status === "REJECTED") return "Seu cadastro foi rejeitado. Fale com o administrador.";
  return "Sua conta ainda nao esta pronta para uso.";
}

export default function PartidasPassadasPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [message, setMessage] = useState("");

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
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({ error: "Falha ao carregar partidas." }));
          throw new Error(payload.error ?? "Falha ao carregar partidas.");
        }

        const payload = (await res.json()) as MatchSummary[];
        const sorted = payload.sort((a, b) => getDateSortValue(b.matchDate) - getDateSortValue(a.matchDate));
        setMatches(sorted);
        setSelectedMatchId((current) =>
          current && sorted.some((matchItem) => matchItem.id === current)
            ? current
            : sorted[0]?.id ?? "",
        );
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Falha ao carregar partidas."));
  }, [activePlayerId]);

  useEffect(() => {
    if (!selectedMatchId || !activePlayerId) return;

    fetch(`/api/matches/${selectedMatchId}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({ error: "Falha ao carregar os dados da partida." }));
          throw new Error(payload.error ?? "Falha ao carregar os dados da partida.");
        }

        const payload = (await res.json()) as MatchDetails;
        setMatch(payload);
        setMessage("");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Falha ao carregar os dados da partida."));
  }, [activePlayerId, selectedMatchId]);

  const teamA = useMemo(
    () => sortByPositionAndName((match?.participants ?? []).filter((participant) => hasTeam(participant.teams, "A"))),
    [match],
  );
  const teamB = useMemo(
    () => sortByPositionAndName((match?.participants ?? []).filter((participant) => hasTeam(participant.teams, "B"))),
    [match],
  );

  const voteSummaryByPlayerId = useMemo(() => {
    if (!match) return {};

    const grouped = new Map<string, { total: number; count: number }>();

    for (const rating of match.ratings) {
      const current = grouped.get(rating.ratedPlayerId) ?? { total: 0, count: 0 };
      grouped.set(rating.ratedPlayerId, {
        total: current.total + rating.rating,
        count: current.count + 1,
      });
    }

    const summaries: Record<string, { average: string; count: number }> = {};

    for (const [playerId, value] of grouped.entries()) {
      const rounded = Math.round((value.total / value.count) * 10) / 10;
      summaries[playerId] = {
        average: Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1),
        count: value.count,
      };
    }

    return summaries;
  }, [match]);

  function renderTeamGrid(title: string, team: TeamCode, participants: Participant[]) {
    const gridColumnsClass =
      "grid-cols-[minmax(0,1fr)_40px_40px_52px_52px] sm:grid-cols-[minmax(0,1fr)_72px_72px_88px_88px]";

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
              <span className="text-center">Nota</span>
              <span className="text-center">Votos</span>
            </div>

            <ul className="mt-2 space-y-2">
              {participants.map((participant) => {
                const stats = team === "A"
                  ? { goals: participant.teamAGoals, assists: participant.teamAAssists }
                  : { goals: participant.teamBGoals, assists: participant.teamBAssists };

                return (
                  <li key={`${participant.playerId}-${team}`} className={`grid ${gridColumnsClass} items-center gap-1 rounded-lg border border-emerald-100 bg-white px-2 py-2 sm:gap-2 sm:px-3`}>
                    <span className="pr-1 text-xs font-medium leading-tight text-emerald-950 sm:text-sm">{formatPlayerLabel(participant.player)}</span>
                    <span className="text-center text-xs text-emerald-900 sm:text-sm">{stats.goals}</span>
                    <span className="text-center text-xs text-emerald-900 sm:text-sm">{stats.assists}</span>
                    <span className="text-center text-xs font-semibold text-emerald-900 sm:text-sm">{voteSummaryByPlayerId[participant.playerId]?.average ?? "-"}</span>
                    <span className="text-center text-xs font-semibold text-emerald-900 sm:text-sm">{voteSummaryByPlayerId[participant.playerId]?.count ?? 0}</span>
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Historico</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Partidas Anteriores</h2>
        <p className="text-sm text-emerald-800">Veja apenas as partidas em que voce jogou. A mais recente fica pre-selecionada.</p>

        {!currentUser ? <StatusNote className="mt-4" tone="warning">Carregando sua conta...</StatusNote> : null}
        {currentUser && !activePlayerId ? <StatusNote className="mt-4" tone="warning">{pendingMessage(currentUser.status)}</StatusNote> : null}

        {activePlayerId ? (
          <label className="mt-4 block max-w-xl" htmlFor="past-match-select">
            <span className="field-label">Escolha a partida</span>
            <select id="past-match-select" className="field-input mt-2" value={selectedMatchId} onChange={(event) => setSelectedMatchId(event.currentTarget.value)}>
              <option value="">Selecione...</option>
              {matches.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatDatePtBr(item.matchDate)} - {item.teamAName} {item.teamAScore ?? "-"} x {item.teamBScore ?? "-"} {item.teamBName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </HeroBlock>

      {activePlayerId && matches.length === 0 ? (
        <SectionShell className="p-4">
          <p className="empty-state text-sm">Voce ainda nao tem partidas encerradas registradas.</p>
        </SectionShell>
      ) : null}

      {match ? (
        <>
          <SectionShell className="p-4">
            <h3 className="text-2xl font-bold text-emerald-950">Resumo da partida</h3>
            <p className="mt-2 text-sm text-emerald-800">
              {formatDatePtBr(match.matchDate)} - {match.teamAName} {match.teamAScore ?? "-"} x {match.teamBScore ?? "-"} {match.teamBName}
            </p>
            {match.location ? <p className="text-sm text-emerald-700">{match.location}</p> : null}
          </SectionShell>

          <section className="grid gap-4 xl:grid-cols-2">
            {renderTeamGrid(match.teamAName || "Time A", "A", teamA)}
            {renderTeamGrid(match.teamBName || "Time B", "B", teamB)}
          </section>
        </>
      ) : null}

      {message ? <StatusNote tone="error">{message}</StatusNote> : null}
    </PageShell>
  );
}
