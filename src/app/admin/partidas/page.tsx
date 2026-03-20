"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { HeroBlock, SectionShell, StatusNote } from "@/components/layout/primitives";
import { formatDatePtBr } from "@/lib/date-format";
import { getPrimaryTeam, getTeamMembershipRank, hasTeam, normalizeTeams, type TeamCode } from "@/lib/team-utils";

type Position = "GOLEIRO" | "ZAGUEIRO" | "MEIA" | "ATACANTE" | "OUTRO";

type Player = {
  id: string;
  name: string;
  position: Position;
};

type Participant = {
  playerId: string;
  presenceStatus: "CONFIRMED" | "WAITLIST" | "CANCELED";
  teams: TeamCode[];
  primaryTeam: TeamCode | null;
  player: Player;
  goals: number;
  assists: number;
  goalsConceded: number;
};

type Match = {
  id: string;
  matchDate: string;
  location: string | null;
  teamAName: string;
  teamBName: string;
  teamAScore: number | null;
  teamBScore: number | null;
  participants: Participant[];
};

type ScoreState = {
  teamAScore: string;
  teamBScore: string;
};

function sortByName<T extends { player: { name: string } }>(list: T[]) {
  return [...list].sort((a, b) => a.player.name.localeCompare(b.player.name));
}

function getPositionCode(position: Position) {
  if (position === "GOLEIRO") return "G";
  if (position === "ZAGUEIRO") return "Z";
  if (position === "MEIA") return "M";
  if (position === "ATACANTE") return "A";
  return "O";
}

function formatPlayerLabel(player: Player) {
  return `${player.name} (${getPositionCode(player.position)})`;
}

function formatParticipantStats(participant: Participant) {
  return `G=${participant.goals} / A=${participant.assists} / GS=${participant.goalsConceded}`;
}

function parseNullableScore(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : Math.min(99, Math.max(0, Math.trunc(parsed)));
}

function sanitizeScoreInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 2);
}

function resolveErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = resolveErrorMessage(item, "");
      if (resolved) return resolved;
    }
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if ("formErrors" in record) {
      const resolved = resolveErrorMessage(record.formErrors, "");
      if (resolved) return resolved;
    }

    if ("fieldErrors" in record && record.fieldErrors && typeof record.fieldErrors === "object") {
      for (const nestedValue of Object.values(record.fieldErrors as Record<string, unknown>)) {
        const resolved = resolveErrorMessage(nestedValue, "");
        if (resolved) return resolved;
      }
    }

    if ("error" in record) {
      const resolved = resolveErrorMessage(record.error, "");
      if (resolved) return resolved;
    }
  }

  return fallback;
}

function scoreStateFromMatch(match: Match | null): ScoreState {
  if (!match) {
    return { teamAScore: "", teamBScore: "" };
  }

  return {
    teamAScore: match.teamAScore === null ? "" : String(match.teamAScore),
    teamBScore: match.teamBScore === null ? "" : String(match.teamBScore),
  };
}

export default function AdminPartidasPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [showNonConfirmedPlayers, setShowNonConfirmedPlayers] = useState(false);
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("Arena dos Coqueiros");
  const [score, setScore] = useState<ScoreState>({ teamAScore: "", teamBScore: "" });
  const [scoreDirty, setScoreDirty] = useState(false);
  const [scoreSaveStatus, setScoreSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [scoreMessage, setScoreMessage] = useState("");

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId) ?? null,
    [matches, selectedMatchId],
  );
  const participantByPlayerId = useMemo(
    () => new Map((selectedMatch?.participants ?? []).map((participant) => [participant.playerId, participant])),
    [selectedMatch],
  );

  const confirmedPlayersWithTeams = useMemo(
    () =>
      [...(selectedMatch?.participants ?? []).filter(
        (participant) => participant.presenceStatus === "CONFIRMED" && participant.teams.length > 0,
      )]
        .sort(
          (left, right) =>
            getTeamMembershipRank(left.teams) - getTeamMembershipRank(right.teams) ||
            left.player.name.localeCompare(right.player.name),
        ),
    [selectedMatch],
  );

  const confirmedPlayersWithoutTeams = useMemo(
    () =>
      sortByName(
        (selectedMatch?.participants ?? []).filter(
          (participant) => participant.presenceStatus === "CONFIRMED" && participant.teams.length === 0,
        ),
      ),
    [selectedMatch],
  );

  const teamAPlayers = useMemo(
    () =>
      sortByName(
        (selectedMatch?.participants ?? []).filter(
          (participant) => participant.presenceStatus === "CONFIRMED" && hasTeam(participant.teams, "A"),
        ),
      ),
    [selectedMatch],
  );

  const teamBPlayers = useMemo(
    () =>
      sortByName(
        (selectedMatch?.participants ?? []).filter(
          (participant) => participant.presenceStatus === "CONFIRMED" && hasTeam(participant.teams, "B"),
        ),
      ),
    [selectedMatch],
  );

  const nonConfirmedPlayers = useMemo(() => {
    const list = players.map((player) => {
      const participant = participantByPlayerId.get(player.id);
      if (participant) return participant;

      return {
        playerId: player.id,
        presenceStatus: "WAITLIST" as const,
        teams: [],
        primaryTeam: null,
        player,
        goals: 0,
        assists: 0,
        goalsConceded: 0,
      };
    });

    return sortByName(list.filter((participant) => participant.presenceStatus !== "CONFIRMED"));
  }, [participantByPlayerId, players]);

  const applyMatchSelection = useCallback((nextMatchId: string, availableMatches: Match[] = matches) => {
    const nextMatch = availableMatches.find((match) => match.id === nextMatchId) ?? null;
    setSelectedMatchId(nextMatchId);
    setShowNonConfirmedPlayers(false);
    setScore(scoreStateFromMatch(nextMatch));
    setScoreDirty(false);
    setScoreSaveStatus("idle");
    setScoreMessage("");
  }, [matches]);

  const loadData = useCallback(async () => {
    const [matchesRes, playersRes] = await Promise.all([
      fetch("/api/admin/matches"),
      fetch("/api/players?active=true"),
    ]);

    const matchesPayload = (await matchesRes.json()) as Match[];
    const playersPayload = (await playersRes.json()) as Player[];

    setMatches(matchesPayload);
    setPlayers(playersPayload);

    const nextSelectedMatchId =
      matchesPayload.length === 0
        ? ""
        : selectedMatchId && matchesPayload.some((match) => match.id === selectedMatchId)
          ? selectedMatchId
          : matchesPayload[0].id;

    applyMatchSelection(nextSelectedMatchId, matchesPayload);
  }, [applyMatchSelection, selectedMatchId]);

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        await loadData();
      } catch {
        if (active) {
          setMessage("Falha ao carregar partidas.");
        }
      }
    }

    void run();

    return () => {
      active = false;
    };
  }, [loadData]);

  useEffect(() => {
    if (!selectedMatch || !scoreDirty) return;

    const timeout = setTimeout(async () => {
      setScoreSaveStatus("saving");

      const parsedTeamAScore = parseNullableScore(score.teamAScore);
      const parsedTeamBScore = parseNullableScore(score.teamBScore);

      const response = await fetch(`/api/admin/matches/${selectedMatch.id}/score`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamAScore: parsedTeamAScore,
          teamBScore: parsedTeamBScore,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Falha ao salvar placar." }));
        setScoreSaveStatus("error");
        setScoreMessage(resolveErrorMessage(payload.error, "Falha ao salvar placar."));
        return;
      }

      setMatches((prev) =>
        prev.map((match) =>
          match.id === selectedMatch.id
            ? {
                ...match,
                teamAScore: parsedTeamAScore,
                teamBScore: parsedTeamBScore,
              }
            : match,
        ),
      );
      setScoreDirty(false);
      setScoreSaveStatus("saved");
      setScoreMessage(`Placar salvo automaticamente em ${new Date().toLocaleTimeString("pt-BR")}.`);
    }, 650);

    return () => clearTimeout(timeout);
  }, [score, scoreDirty, selectedMatch]);

  async function createMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/matches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ matchDate: date, location }),
    });

    if (!response.ok) {
      setMessage("Falha ao criar partida.");
      return;
    }

    setDate("");
    setLocation("Arena dos Coqueiros");
    setMessage("Partida criada.");
    await loadData();
  }

  async function setPlayerTeams(playerId: string, teams: TeamCode[]) {
    if (!selectedMatch) return;
    const matchId = selectedMatch.id;

    const response = await fetch(`/api/admin/matches/${matchId}/teams`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assignments: [{ playerId, teams: normalizeTeams(teams) }] }),
    });

    if (!response.ok) {
      setMessage("Falha ao atualizar os times do jogador.");
      return;
    }

    const payload = (await response.json()) as {
      updatedParticipants: Array<
        Pick<Participant, "playerId" | "presenceStatus" | "teams" | "primaryTeam" | "goals" | "assists" | "goalsConceded">
      >;
    };

    const updatedParticipant = payload.updatedParticipants.find((participant) => participant.playerId === playerId);
    if (!updatedParticipant) return;

    setMatches((prev) =>
      prev.map((match) => {
        if (match.id !== matchId) return match;

        const existingParticipant = match.participants.find((participant) => participant.playerId === playerId);
        const player = existingParticipant?.player ?? players.find((item) => item.id === playerId);
        if (!player) return match;

        const nextParticipant: Participant = {
          ...updatedParticipant,
          player,
        };

        const remainingParticipants = match.participants.filter((participant) => participant.playerId !== playerId);

        return {
          ...match,
          participants: [...remainingParticipants, nextParticipant],
        };
      }),
    );

    setMessage("Times atualizados somente para a partida selecionada.");
  }

  async function setPlayerPrimaryTeam(participant: Participant, primaryTeam: TeamCode) {
    if (!selectedMatch) return;
    const matchId = selectedMatch.id;

    const response = await fetch(`/api/admin/matches/${matchId}/teams`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        assignments: [{ playerId: participant.playerId, teams: normalizeTeams(participant.teams), primaryTeam }],
      }),
    });

    if (!response.ok) {
      setMessage("Falha ao atualizar o time principal.");
      return;
    }

    const payload = (await response.json()) as {
      updatedParticipants: Array<
        Pick<Participant, "playerId" | "presenceStatus" | "teams" | "primaryTeam" | "goals" | "assists" | "goalsConceded">
      >;
    };

    const updatedParticipant = payload.updatedParticipants.find(
      (updatedItem) => updatedItem.playerId === participant.playerId,
    );
    if (!updatedParticipant) return;

    setMatches((prev) =>
      prev.map((match) => {
        if (match.id !== matchId) return match;

        const nextParticipant: Participant = {
          ...updatedParticipant,
          player: participant.player,
        };

        const remainingParticipants = match.participants.filter(
          (currentParticipant) => currentParticipant.playerId !== participant.playerId,
        );

        return {
          ...match,
          participants: [...remainingParticipants, nextParticipant],
        };
      }),
    );

    setMessage(`Time principal de ${participant.player.name} atualizado nesta partida.`);
  }

  async function setPlayerPresenceStatus(playerId: string, presenceStatus: Participant["presenceStatus"]) {
    if (!selectedMatch) return;
    const matchId = selectedMatch.id;

    const response = await fetch(`/api/admin/matches/${matchId}/participants/${playerId}/presence`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ presenceStatus }),
    });

    if (!response.ok) {
      setMessage("Falha ao atualizar a confirmacao do jogador.");
      return;
    }

    const updatedParticipant = (await response.json()) as Pick<
      Participant,
      "playerId" | "presenceStatus" | "teams" | "primaryTeam" | "goals" | "assists" | "goalsConceded"
    >;

    setMatches((prev) =>
      prev.map((match) => {
        if (match.id !== matchId) return match;

        const existingParticipant = match.participants.find((participant) => participant.playerId === playerId);
        const player = existingParticipant?.player ?? players.find((item) => item.id === playerId);
        if (!player) return match;

        const nextParticipant: Participant = {
          ...updatedParticipant,
          player,
        };

        const remainingParticipants = match.participants.filter((participant) => participant.playerId !== playerId);

        return {
          ...match,
          participants: [...remainingParticipants, nextParticipant],
        };
      }),
    );

    setMessage("Jogador desconfirmado somente para a partida selecionada.");
  }

  async function archiveSelectedMatch() {
    if (!selectedMatch) return;

    const confirmed = window.confirm("Tem certeza que deseja excluir esta partida?");
    if (!confirmed) return;

    const response = await fetch(`/api/admin/matches/${selectedMatch.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" }),
    });

    if (!response.ok) {
      setMessage("Falha ao excluir partida.");
      return;
    }

    setMessage("Partida excluida.");
    await loadData();
  }

  function updateScore(field: keyof ScoreState, value: string) {
    setScore((prev) => ({ ...prev, [field]: sanitizeScoreInput(value) }));
    setScoreDirty(true);
    setScoreSaveStatus("idle");
  }

  function toggleTeamAssignment(participant: Participant, team: TeamCode) {
    const nextTeams = hasTeam(participant.teams, team)
      ? participant.teams.filter((currentTeam) => currentTeam !== team)
      : [...participant.teams, team];

    setPlayerTeams(participant.playerId, nextTeams).catch(() => setMessage("Falha ao atualizar os times."));
  }

  function renderAssignmentButtons(participant: Participant, allowUnconfirm = false) {
    const buttonClass =
      "rounded-full border px-3 py-1 text-xs font-semibold transition sm:text-sm";

    return (
      <div className="flex flex-wrap gap-2">
        {allowUnconfirm ? (
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-red-50 text-xs font-bold text-red-700 transition hover:bg-red-100 sm:h-8 sm:w-8"
            aria-label={`Desconfirmar ${participant.player.name} da partida selecionada`}
            onClick={() =>
              setPlayerPresenceStatus(participant.playerId, "CANCELED").catch(() =>
                setMessage("Falha ao desconfirmar o jogador."),
              )
            }
          >
            X
          </button>
        ) : null}
        <button
          type="button"
          className={`${buttonClass} ${
            hasTeam(participant.teams, "A")
              ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
              : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
          }`}
          onClick={() => toggleTeamAssignment(participant, "A")}
        >
          {selectedMatch?.teamAName ?? "Time A"}
        </button>
        <button
          type="button"
          className={`${buttonClass} ${
            hasTeam(participant.teams, "B")
              ? "border-red-600 bg-red-600 text-white hover:bg-red-700"
              : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          }`}
          onClick={() => toggleTeamAssignment(participant, "B")}
        >
          {selectedMatch?.teamBName ?? "Time B"}
        </button>
      </div>
    );
  }

  function renderAssignmentRow(
    participant: Participant,
    options?: { showStatusLabel?: boolean; allowUnconfirm?: boolean },
  ) {
    const showStatusLabel = options?.showStatusLabel ?? false;
    const allowUnconfirm = options?.allowUnconfirm ?? false;
    const statusLabel = participant.presenceStatus === "CANCELED" ? "Desconfirmado" : "Pendente";

    return (
      <div
        key={participant.playerId}
        className="rounded-xl border border-emerald-200 bg-white px-3 py-3 text-sm font-medium text-emerald-950 shadow-sm"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="pr-1">
              {formatPlayerLabel(participant.player)}{" "}
              <span className="text-xs font-medium text-emerald-700">{formatParticipantStats(participant)}</span>
            </p>
            {showStatusLabel ? (
              <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-emerald-700">{statusLabel}</p>
            ) : null}
          </div>
          {renderAssignmentButtons(participant, allowUnconfirm)}
        </div>
      </div>
    );
  }

  function renderTeamCardEntry(participant: Participant, team: TeamCode) {
    const primaryTeam = getPrimaryTeam(participant.primaryTeam, participant.teams);
    const isDualTeamPlayer = participant.teams.length === 2 && primaryTeam !== null;
    const isPrimaryTeam = primaryTeam === team;

    return (
      <div
        key={`${participant.playerId}-${team}`}
        className={`rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-900 ${
          team === "A" ? "border-blue-100" : "border-red-100"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p>{formatPlayerLabel(participant.player)}</p>
            {isDualTeamPlayer && isPrimaryTeam ? (
              <p
                className={`mt-1 text-[10px] italic font-medium ${
                  team === "A" ? "text-blue-700" : "text-red-700"
                }`}
              >
                Considerado o time principal
              </p>
            ) : null}
          </div>
          {isDualTeamPlayer && !isPrimaryTeam ? (
            <button
              type="button"
              className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-emerald-800 transition hover:bg-emerald-100"
              onClick={() =>
                setPlayerPrimaryTeam(participant, team).catch(() =>
                  setMessage("Falha ao atualizar o time principal."),
                )
              }
            >
              Definir este time como principal
            </button>
          ) : null}
        </div>
        <p className="text-xs font-medium text-slate-600">{formatParticipantStats(participant)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HeroBlock className="p-5 sm:p-6">
        <h2 className="text-3xl font-bold text-emerald-950">Partidas</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={createMatch}>
          <label>
            <span className="field-label">Data</span>
            <input className="field-input" type="date" required value={date} onChange={(event) => setDate(event.currentTarget.value)} />
          </label>
          <label>
            <span className="field-label">Local</span>
            <input className="field-input" value={location} onChange={(event) => setLocation(event.currentTarget.value)} />
          </label>
          <div className="flex items-end">
            <button className="btn btn-primary w-full" type="submit">
              Criar partida
            </button>
          </div>
        </form>
      </HeroBlock>

      <SectionShell className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_140px] lg:items-end">
          <label>
            <span className="field-label">Selecione uma partida</span>
            <select
              id="match-select"
              className="field-input"
              value={selectedMatchId}
              onChange={(event) => applyMatchSelection(event.currentTarget.value)}
            >
              <option value="">-- selecione --</option>
              {matches.map((match) => (
                <option key={match.id} value={match.id}>
                  {formatDatePtBr(match.matchDate)}
                  {match.location ? ` - ${match.location}` : " - Local a definir"}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="field-label">{selectedMatch?.teamAName ?? "Time A"}</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              className="field-input text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              disabled={!selectedMatch}
              value={score.teamAScore}
              onChange={(event) => updateScore("teamAScore", event.currentTarget.value)}
            />
          </label>

          <label>
            <span className="field-label">{selectedMatch?.teamBName ?? "Time B"}</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              className="field-input text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              disabled={!selectedMatch}
              value={score.teamBScore}
              onChange={(event) => updateScore("teamBScore", event.currentTarget.value)}
            />
          </label>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!selectedMatch}
            onClick={() => archiveSelectedMatch().catch(() => setMessage("Falha ao excluir partida."))}
          >
            Excluir partida
          </button>
        </div>

        {scoreSaveStatus === "saving" ? <p className="mt-2 text-sm text-amber-700">Salvando placar...</p> : null}
        {scoreSaveStatus === "saved" ? <p className="mt-2 text-sm text-emerald-800">{scoreMessage}</p> : null}
        {scoreSaveStatus === "error" ? <p className="mt-2 text-sm text-red-700">{scoreMessage}</p> : null}
      </SectionShell>

      {selectedMatch ? (
        <SectionShell className="p-4">
          <h3 className="text-xl font-semibold text-emerald-950">Definicao dos times</h3>
          <p className="mt-1 text-sm text-emerald-800">
            Marque Time A e Time B em cada jogador confirmado. O mesmo atleta pode ficar nos dois times ao mesmo tempo.
          </p>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <h4 className="font-semibold text-emerald-950">
                Com time definido ({confirmedPlayersWithTeams.length})
              </h4>
              <p className="mt-1 text-xs text-emerald-800">
                Lista ordenada por Time A, Time B e A/B.
              </p>
              <div className="mt-3 space-y-2">
                {confirmedPlayersWithTeams.length === 0 ? (
                  <p className="rounded-lg bg-white px-3 py-2 text-sm text-emerald-800">Nenhum jogador com time definido.</p>
                ) : (
                  confirmedPlayersWithTeams.map((participant) =>
                    renderAssignmentRow(participant, { allowUnconfirm: true }),
                  )
                )}
              </div>

              <div className="mt-4 border-t border-emerald-200 pt-3">
                <h5 className="font-semibold text-emerald-950">
                  Confirmados sem time ({confirmedPlayersWithoutTeams.length})
                </h5>
                <p className="mt-1 text-xs text-emerald-800">
                  Jogadores confirmados para esta partida, mas ainda sem Time A ou Time B.
                </p>
                <div className="mt-2 space-y-2">
                  {confirmedPlayersWithoutTeams.length === 0 ? (
                    <p className="rounded-lg bg-white px-3 py-2 text-sm text-emerald-800">Nenhum confirmado sem time.</p>
                  ) : (
                    confirmedPlayersWithoutTeams.map((participant) =>
                      renderAssignmentRow(participant, { allowUnconfirm: true }),
                    )
                  )}
                </div>
              </div>

              <div className="mt-4 border-t border-emerald-200 pt-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-sm font-semibold text-emerald-950 transition hover:bg-emerald-100"
                  onClick={() => setShowNonConfirmedPlayers((current) => !current)}
                >
                  <span>Nao confirmados ({nonConfirmedPlayers.length})</span>
                  <span className="text-xs uppercase tracking-[0.08em] text-emerald-700">
                    {showNonConfirmedPlayers ? "Ocultar" : "Mostrar"}
                  </span>
                </button>
                <p className="mt-2 text-xs text-emerald-800">
                  Se voce marcar Time A ou Time B aqui, a alteracao vale apenas para esta partida selecionada.
                </p>
                {showNonConfirmedPlayers ? (
                  <div className="mt-2 space-y-2">
                    {nonConfirmedPlayers.length === 0 ? (
                      <p className="rounded-lg bg-white px-3 py-2 text-sm text-emerald-800">Nenhum jogador nao confirmado.</p>
                    ) : (
                      nonConfirmedPlayers.map((participant) =>
                        renderAssignmentRow(participant, { showStatusLabel: true }),
                      )
                    )}
                  </div>
                ) : null}
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <section className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                <h4 className="font-semibold text-slate-950">{selectedMatch.teamAName} ({teamAPlayers.length})</h4>
                <div className="mt-3 space-y-2">
                  {teamAPlayers.length === 0 ? (
                    <p className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">Nenhum jogador neste time.</p>
                  ) : (
                    teamAPlayers.map((participant) => renderTeamCardEntry(participant, "A"))
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-red-200 bg-red-50 p-3">
                <h4 className="font-semibold text-slate-950">{selectedMatch.teamBName} ({teamBPlayers.length})</h4>
                <div className="mt-3 space-y-2">
                  {teamBPlayers.length === 0 ? (
                    <p className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">Nenhum jogador neste time.</p>
                  ) : (
                    teamBPlayers.map((participant) => renderTeamCardEntry(participant, "B"))
                  )}
                </div>
              </section>
            </div>
          </div>
        </SectionShell>
      ) : null}

      {message ? <StatusNote tone="neutral">{message}</StatusNote> : null}
    </div>
  );
}


