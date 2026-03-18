"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HeroBlock, PageShell, SectionShell, StatusNote } from "@/components/layout/primitives";
import { StarRating } from "@/components/star-rating";
import { Button } from "@/components/ui/button";
import { formatDatePtBr, getDateSortValue } from "@/lib/date-format";
import { hasTeam, type TeamCode, type TeamSplitStats } from "@/lib/team-utils";

type CurrentUser = {
  id: string;
  role: "ADMIN" | "PLAYER";
  status: "PENDING_VERIFICATION" | "PENDING_APPROVAL" | "ACTIVE" | "DISABLED" | "REJECTED";
  playerId: string | null;
  mustChangePassword?: boolean;
};

type Position = "GOLEIRO" | "ZAGUEIRO" | "MEIA" | "ATACANTE" | "OUTRO";
type MatchEditReason = "ADMIN" | "LAST_MATCH_PLAYER" | "LOCKED_NOT_LAST_MATCH" | "LOCKED_DID_NOT_PLAY" | "LOCKED_NOT_ACTIVE";

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
  canEdit: boolean;
  editReason: MatchEditReason;
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
  if (status === "PENDING_APPROVAL") return "Sua conta esta sendo atualizada para o novo fluxo.";
  if (status === "REJECTED") return "Seu cadastro foi rejeitado. Fale com o administrador.";
  if (status === "DISABLED") return "Seu acesso foi removido. Fale com o administrador.";
  return "Sua conta ainda nao esta pronta para uso.";
}

function getEditStatus(toneReason: MatchEditReason) {
  if (toneReason === "ADMIN") {
    return { tone: "success" as const, message: "Editavel por admin." };
  }

  if (toneReason === "LAST_MATCH_PLAYER") {
    return { tone: "success" as const, message: "Editavel porque foi o ultimo jogo anterior e voce jogou esta partida." };
  }

  if (toneReason === "LOCKED_DID_NOT_PLAY") {
    return { tone: "warning" as const, message: "Bloqueado: voce nao jogou o ultimo jogo anterior do sistema." };
  }

  if (toneReason === "LOCKED_NOT_LAST_MATCH") {
    return { tone: "warning" as const, message: "Bloqueado: apenas o ultimo jogo anterior do sistema pode ser editado por atletas." };
  }

  return { tone: "warning" as const, message: "Bloqueado para a sua conta atual." };
}

export default function PartidasPassadasPage() {
  const searchParams = useSearchParams();
  const requestedMatchId = searchParams.get("matchId");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [message, setMessage] = useState("");
  const [scoreState, setScoreState] = useState<ScoreState>({ teamAScore: "", teamBScore: "" });
  const [statsState, setStatsState] = useState<Record<string, TeamSplitStats>>({});
  const [ratingsState, setRatingsState] = useState<Record<string, number>>({});
  const [scoreSaving, setScoreSaving] = useState(false);
  const [statsSaving, setStatsSaving] = useState(false);
  const [ratingsSaving, setRatingsSaving] = useState(false);

  const isActiveUser = currentUser?.status === "ACTIVE" && !currentUser.mustChangePassword;
  const isAdmin = currentUser?.role === "ADMIN" && isActiveUser;
  const currentRaterPlayerId = currentUser?.playerId ?? null;

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
    if (!currentUser || !isActiveUser) return;

    const endpoint = isAdmin
      ? `/api/matches?to=${getTodayIsoDate()}`
      : `/api/matches?to=${getTodayIsoDate()}&playerId=me`;

    fetch(endpoint, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({ error: "Falha ao carregar partidas." }));
          throw new Error(payload.error ?? "Falha ao carregar partidas.");
        }

        const payload = (await res.json()) as MatchSummary[];
        const sorted = payload.sort((a, b) => getDateSortValue(b.matchDate) - getDateSortValue(a.matchDate));
        setMatches(sorted);
        setSelectedMatchId((current) =>
          requestedMatchId && sorted.some((matchItem) => matchItem.id === requestedMatchId)
            ? requestedMatchId
            : current && sorted.some((matchItem) => matchItem.id === current)
            ? current
            : sorted[0]?.id ?? "",
        );
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Falha ao carregar partidas."));
  }, [currentUser, isActiveUser, isAdmin, requestedMatchId]);

  useEffect(() => {
    if (!selectedMatchId || !isActiveUser) return;

    fetch(`/api/matches/${selectedMatchId}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({ error: "Falha ao carregar os dados da partida." }));
          throw new Error(payload.error ?? "Falha ao carregar os dados da partida.");
        }

        const payload = (await res.json()) as MatchDetails;
        setMatch(payload);
        setScoreState({
          teamAScore: payload.teamAScore === null ? "" : String(payload.teamAScore),
          teamBScore: payload.teamBScore === null ? "" : String(payload.teamBScore),
        });

        const initialStats: Record<string, TeamSplitStats> = {};
        for (const participant of payload.participants) {
          initialStats[participant.playerId] = {
            teamAGoals: participant.teamAGoals,
            teamAAssists: participant.teamAAssists,
            teamAGoalsConceded: participant.teamAGoalsConceded,
            teamBGoals: participant.teamBGoals,
            teamBAssists: participant.teamBAssists,
            teamBGoalsConceded: participant.teamBGoalsConceded,
          };
        }
        setStatsState(initialStats);

        const initialRatings: Record<string, number> = {};
        if (currentRaterPlayerId) {
          for (const rating of payload.ratings) {
            if (rating.raterPlayerId === currentRaterPlayerId) {
              initialRatings[rating.ratedPlayerId] = rating.rating;
            }
          }
        }
        setRatingsState(initialRatings);
        setMessage("");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Falha ao carregar os dados da partida."));
  }, [currentRaterPlayerId, isActiveUser, selectedMatchId]);

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

  function getTeamFieldNames(team: TeamCode) {
    if (team === "A") {
      return {
        goals: "teamAGoals" as const,
        assists: "teamAAssists" as const,
        goalsConceded: "teamAGoalsConceded" as const,
      };
    }

    return {
      goals: "teamBGoals" as const,
      assists: "teamBAssists" as const,
      goalsConceded: "teamBGoalsConceded" as const,
    };
  }

  function updateStat(playerId: string, field: keyof TeamSplitStats, value: number) {
    setStatsState((prev) => ({
      ...prev,
      [playerId]: {
        teamAGoals: prev[playerId]?.teamAGoals ?? 0,
        teamAAssists: prev[playerId]?.teamAAssists ?? 0,
        teamAGoalsConceded: prev[playerId]?.teamAGoalsConceded ?? 0,
        teamBGoals: prev[playerId]?.teamBGoals ?? 0,
        teamBAssists: prev[playerId]?.teamBAssists ?? 0,
        teamBGoalsConceded: prev[playerId]?.teamBGoalsConceded ?? 0,
        [field]: Number.isNaN(value) ? 0 : Math.max(0, value),
      },
    }));
  }

  async function saveScore() {
    if (!match || !match.canEdit) return;
    setScoreSaving(true);
    try {
      const response = await fetch(`/api/matches/${match.id}/score`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamAScore: scoreState.teamAScore === "" ? null : Number(scoreState.teamAScore),
          teamBScore: scoreState.teamBScore === "" ? null : Number(scoreState.teamBScore),
        }),
      });

      if (!response.ok) {
        const payloadError = await response.json().catch(() => ({ error: "Erro ao salvar placar." }));
        setMessage(payloadError.error ?? "Erro ao salvar placar.");
        return;
      }

      setMessage("Placar salvo.");
      setMatch((current) =>
        current
          ? {
              ...current,
              teamAScore: scoreState.teamAScore === "" ? null : Number(scoreState.teamAScore),
              teamBScore: scoreState.teamBScore === "" ? null : Number(scoreState.teamBScore),
            }
          : current,
      );
    } finally {
      setScoreSaving(false);
    }
  }

  async function saveStats() {
    if (!match || !match.canEdit) return;
    setStatsSaving(true);
    try {
      const response = await fetch(`/api/matches/${match.id}/stats`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          createdByPlayerId: currentUser?.playerId ?? undefined,
          stats: match.participants.map((participant) => ({
            playerId: participant.playerId,
            teamAGoals: statsState[participant.playerId]?.teamAGoals ?? 0,
            teamAAssists: statsState[participant.playerId]?.teamAAssists ?? 0,
            teamAGoalsConceded: statsState[participant.playerId]?.teamAGoalsConceded ?? 0,
            teamBGoals: statsState[participant.playerId]?.teamBGoals ?? 0,
            teamBAssists: statsState[participant.playerId]?.teamBAssists ?? 0,
            teamBGoalsConceded: statsState[participant.playerId]?.teamBGoalsConceded ?? 0,
          })),
        }),
      });

      if (!response.ok) {
        const payloadError = await response.json().catch(() => ({ error: "Erro ao salvar estatisticas." }));
        setMessage(payloadError.error ?? "Erro ao salvar estatisticas.");
        return;
      }

      setMessage("Estatisticas salvas.");
      setMatch((current) =>
        current
          ? {
              ...current,
              participants: current.participants.map((participant) => ({
                ...participant,
                ...statsState[participant.playerId],
              })),
            }
          : current,
      );
    } finally {
      setStatsSaving(false);
    }
  }

  async function saveRatings() {
    if (!match || !match.canEdit || !currentRaterPlayerId) {
      setMessage("Nao foi possivel identificar o jogador avaliador.");
      return;
    }

    const payload = {
      ratings: Object.entries(ratingsState).map(([ratedPlayerId, rating]) => ({
        ratedPlayerId,
        rating,
      })),
    };

    if (payload.ratings.length === 0) {
      setMessage("Preencha ao menos uma nota.");
      return;
    }

    setRatingsSaving(true);
    try {
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
      setMatch((current) => {
        if (!current) return current;

        const persistedRatings = current.ratings.filter((rating) => rating.raterPlayerId !== currentRaterPlayerId);
        const nextRatings = Object.entries(ratingsState).map(([ratedPlayerId, rating]) => ({
          raterPlayerId: currentRaterPlayerId,
          ratedPlayerId,
          rating,
        }));

        return {
          ...current,
          ratings: [...persistedRatings, ...nextRatings],
        };
      });
    } finally {
      setRatingsSaving(false);
    }
  }

  function renderTeamGrid(title: string, team: TeamCode, participants: Participant[]) {
    const gridColumnsClass =
      "grid-cols-[minmax(0,1fr)_48px_48px_56px_52px_52px] sm:grid-cols-[minmax(0,1fr)_72px_72px_96px_88px_88px]";

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
              <span className="text-center">Nota</span>
              <span className="text-center">Votos</span>
            </div>

            <ul className="mt-2 space-y-2">
              {participants.map((participant) => {
                const fields = getTeamFieldNames(team);
                const note = voteSummaryByPlayerId[participant.playerId];

                return (
                  <li key={`${participant.playerId}-${team}`} className={`grid ${gridColumnsClass} items-center gap-1 rounded-lg border border-emerald-100 bg-white px-2 py-2 sm:gap-2 sm:px-3`}>
                    <span className="pr-1 text-xs font-medium leading-tight text-emerald-950 sm:text-sm">{formatPlayerLabel(participant.player)}</span>
                    {match?.canEdit ? (
                      <>
                        <input className="field-input h-9 px-2 text-center" type="number" min={0} value={statsState[participant.playerId]?.[fields.goals] ?? 0} onChange={(event) => updateStat(participant.playerId, fields.goals, Number(event.currentTarget.value))} />
                        <input className="field-input h-9 px-2 text-center" type="number" min={0} value={statsState[participant.playerId]?.[fields.assists] ?? 0} onChange={(event) => updateStat(participant.playerId, fields.assists, Number(event.currentTarget.value))} />
                        <input className="field-input h-9 px-2 text-center" type="number" min={0} value={statsState[participant.playerId]?.[fields.goalsConceded] ?? 0} onChange={(event) => updateStat(participant.playerId, fields.goalsConceded, Number(event.currentTarget.value))} />
                      </>
                    ) : (
                      <>
                        <span className="text-center text-xs text-emerald-900 sm:text-sm">{statsState[participant.playerId]?.[fields.goals] ?? 0}</span>
                        <span className="text-center text-xs text-emerald-900 sm:text-sm">{statsState[participant.playerId]?.[fields.assists] ?? 0}</span>
                        <span className="text-center text-xs text-emerald-900 sm:text-sm">{statsState[participant.playerId]?.[fields.goalsConceded] ?? 0}</span>
                      </>
                    )}
                    <span className="text-center text-xs font-semibold text-emerald-900 sm:text-sm">{note?.average ?? "-"}</span>
                    <span className="text-center text-xs font-semibold text-emerald-900 sm:text-sm">{note?.count ?? 0}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </SectionShell>
    );
  }

  const editStatus = match ? getEditStatus(match.editReason) : null;
  const editableRatingsParticipants = (match?.participants ?? []).filter((participant) => participant.playerId !== currentRaterPlayerId);

  return (
    <PageShell>
      <HeroBlock className="p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Historico</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Partidas Anteriores</h2>
        <p className="text-sm text-emerald-800">
          {isAdmin
            ? "Admins podem consultar e editar qualquer partida anterior."
            : "Veja apenas as partidas em que voce jogou. O ultimo jogo anterior elegivel pode ser editado."}
        </p>

        {!currentUser ? <StatusNote className="mt-4" tone="warning">Carregando sua conta...</StatusNote> : null}
        {currentUser && !isActiveUser ? <StatusNote className="mt-4" tone="warning">{pendingMessage(currentUser.status)}</StatusNote> : null}

        {isActiveUser ? (
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

      {isActiveUser && matches.length === 0 ? (
        <SectionShell className="p-4">
          <p className="empty-state text-sm">Nenhuma partida anterior encontrada.</p>
        </SectionShell>
      ) : null}

      {match ? (
        <>
          <SectionShell className="space-y-4 p-4">
            <div>
              <h3 className="text-2xl font-bold text-emerald-950">Resumo da partida</h3>
              <p className="mt-2 text-sm text-emerald-800">
                {formatDatePtBr(match.matchDate)} - {match.teamAName} {match.teamAScore ?? "-"} x {match.teamBScore ?? "-"} {match.teamBName}
              </p>
              {match.location ? <p className="text-sm text-emerald-700">{match.location}</p> : null}
            </div>

            {editStatus ? <StatusNote tone={editStatus.tone}>{editStatus.message}</StatusNote> : null}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="field-label">Placar {match.teamAName}</span>
                  <input className="field-input mt-2" type="number" min={0} value={scoreState.teamAScore} onChange={(event) => setScoreState((current) => ({ ...current, teamAScore: event.currentTarget.value }))} disabled={!match.canEdit} />
                </label>
                <label>
                  <span className="field-label">Placar {match.teamBName}</span>
                  <input className="field-input mt-2" type="number" min={0} value={scoreState.teamBScore} onChange={(event) => setScoreState((current) => ({ ...current, teamBScore: event.currentTarget.value }))} disabled={!match.canEdit} />
                </label>
              </div>
              <Button className="rounded-full" type="button" onClick={saveScore} disabled={!match.canEdit || scoreSaving}>
                {scoreSaving ? "Salvando placar..." : "Salvar placar"}
              </Button>
            </div>
          </SectionShell>

          <section className="grid gap-4 xl:grid-cols-2">
            {renderTeamGrid(match.teamAName || "Time A", "A", teamA)}
            {renderTeamGrid(match.teamBName || "Time B", "B", teamB)}
          </section>

          <SectionShell className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-2xl font-bold text-emerald-950">Estatisticas</h3>
                <p className="text-sm text-emerald-800">Edite gols, assistencias e gols sofridos apenas quando a partida estiver liberada.</p>
              </div>
              <Button className="rounded-full" type="button" onClick={saveStats} disabled={!match.canEdit || statsSaving}>
                {statsSaving ? "Salvando estatisticas..." : "Salvar estatisticas"}
              </Button>
            </div>
          </SectionShell>

          <SectionShell className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-2xl font-bold text-emerald-950">Notas do jogo</h3>
                <p className="text-sm text-emerald-800">Registre ou ajuste as avaliacoes da partida quando permitido.</p>
              </div>
              <Button className="rounded-full" type="button" variant="outline" onClick={saveRatings} disabled={!match.canEdit || !currentRaterPlayerId || ratingsSaving}>
                {ratingsSaving ? "Salvando notas..." : "Salvar notas"}
              </Button>
            </div>

            {editableRatingsParticipants.length === 0 ? (
              <p className="mt-4 text-sm text-emerald-800">Nenhum jogador disponivel para avaliacao nesta partida.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {editableRatingsParticipants.map((participant) => (
                  <div
                    key={participant.playerId}
                    className="flex flex-col gap-2 rounded-xl border border-emerald-100 bg-white p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <span className="font-medium text-emerald-900">{formatPlayerLabel(participant.player)}</span>
                      <p className="text-xs text-emerald-700">Media atual: {voteSummaryByPlayerId[participant.playerId]?.average ?? "-"} ({voteSummaryByPlayerId[participant.playerId]?.count ?? 0} votos)</p>
                    </div>
                    <StarRating
                      value={ratingsState[participant.playerId] ?? 0}
                      onChange={(value) => {
                        if (!match?.canEdit) return;

                        setRatingsState((prev) => ({
                          ...prev,
                          [participant.playerId]: value,
                        }));
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </SectionShell>
        </>
      ) : null}

      {message ? <StatusNote tone="error">{message}</StatusNote> : null}
    </PageShell>
  );
}
