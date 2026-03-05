"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { formatDatePtBr, getDateSortValue } from "@/lib/date-format";

type Player = {
  id: string;
  name: string;
  position: "GOLEIRO" | "ZAGUEIRO" | "MEIA" | "ATACANTE" | "OUTRO";
};

type PresenceStatus = "CONFIRMED" | "WAITLIST" | "CANCELED";

type Participant = {
  playerId: string;
  presenceStatus: PresenceStatus;
  team: "A" | "B" | null;
  player: Player;
};

type Match = {
  id: string;
  matchDate: string;
  location: string | null;
  startTime: string;
  participants: Participant[];
};

type ListViewFilter = "ALL" | "PENDING" | "CONFIRMED" | "CANCELED";
type MatchCardVariant = "default" | "desktopSecondary" | "mobileSecondary";

function getTodayIsoDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().slice(0, 10);
}

function getPositionCode(position: Player["position"]) {
  if (position === "GOLEIRO") return "G";
  if (position === "ZAGUEIRO") return "Z";
  if (position === "MEIA") return "M";
  if (position === "ATACANTE") return "A";
  return "O";
}

function getPositionOrder(position: Player["position"]) {
  if (position === "GOLEIRO") return 0;
  if (position === "ZAGUEIRO") return 1;
  if (position === "MEIA") return 2;
  if (position === "ATACANTE") return 3;
  return 4;
}

function formatPlayerLabel(player: Player) {
  return `${player.name} (${getPositionCode(player.position)})`;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function ActionButton({
  label,
  tone,
  onClick,
  children,
}: {
  label: string;
  tone: "green" | "red" | "yellow";
  onClick: () => void;
  children: ReactNode;
}) {
  const className =
    tone === "green"
      ? "inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
      : tone === "red"
        ? "inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
        : "inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-white hover:bg-amber-500";

  return (
    <button type="button" className={className} onClick={onClick} aria-label={label}>
      {children}
    </button>
  );
}

function MatchSummaryCard({
  match,
  active,
  onClick,
  variant = "default",
}: {
  match: Match;
  active: boolean;
  onClick: () => void;
  variant?: MatchCardVariant;
}) {
  const isMobileSecondary = variant === "mobileSecondary";
  const isDesktopSecondary = variant === "desktopSecondary";
  const isDefault = variant === "default";
  const locationTextClass =
    "truncate uppercase text-emerald-700 text-[0.45rem] tracking-[0.08em] sm:text-[0.6rem]";
  const widthClass = isMobileSecondary
    ? "w-fit shrink-0 snap-start px-3 py-2"
    : isDesktopSecondary
      ? "w-full h-full min-w-0"
      : "w-fit min-w-0 px-3 py-2 sm:w-full";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${widthClass} rounded-xl border px-3 py-2 text-left transition ${
        active
          ? "border-emerald-700 bg-emerald-100"
          : "border-emerald-200 bg-white hover:border-emerald-400"
      }`}
    >
      <p
        className={`font-semibold text-emerald-950 ${
          isMobileSecondary ? "whitespace-nowrap text-sm leading-tight" : "text-sm sm:text-base"
        }`}
      >
        {formatDatePtBr(match.matchDate)}
        {isDefault ? ` - ${match.startTime}` : ""}
      </p>
      {isMobileSecondary ? null : (
        <p className={locationTextClass}>
          {match.location ? match.location : "Local a definir"}
        </p>
      )}
    </button>
  );
}

export default function HomePage() {
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [listViewFilter, setListViewFilter] = useState<ListViewFilter>("ALL");
  const [message, setMessage] = useState<string>("");
  const [actionMessage, setActionMessage] = useState<string>("");

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId) ?? null,
    [matches, selectedMatchId],
  );
  const primaryMatch = useMemo(() => matches[0] ?? null, [matches]);

  const otherMatches = useMemo(
    () => matches.slice(1),
    [matches],
  );

  const confirmed = useMemo(
    () =>
      [...(selectedMatch?.participants.filter((item) => item.presenceStatus === "CONFIRMED") ?? [])].sort((a, b) => {
        const byPosition = getPositionOrder(a.player.position) - getPositionOrder(b.player.position);
        if (byPosition !== 0) return byPosition;
        return a.player.name.localeCompare(b.player.name);
      }),
    [selectedMatch],
  );

  const canceled = useMemo(
    () =>
      [...(selectedMatch?.participants.filter((item) => item.presenceStatus === "CANCELED") ?? [])].sort((a, b) =>
        a.player.name.localeCompare(b.player.name),
      ),
    [selectedMatch],
  );

  const pending = useMemo(() => {
    const statusByPlayer = new Map(
      selectedMatch?.participants.map((participant) => [participant.playerId, participant.presenceStatus]) ?? [],
    );

    return allPlayers.filter((player) => {
      const status = statusByPlayer.get(player.id);
      return status !== "CONFIRMED" && status !== "CANCELED";
    });
  }, [allPlayers, selectedMatch]);

  const normalizedSearchTerm = useMemo(() => normalizeText(searchTerm), [searchTerm]);

  const filteredPending = useMemo(
    () =>
      pending.filter((player) =>
        normalizedSearchTerm === "" ? true : normalizeText(player.name).includes(normalizedSearchTerm),
      ),
    [normalizedSearchTerm, pending],
  );

  const filteredConfirmed = useMemo(
    () =>
      confirmed.filter((item) =>
        normalizedSearchTerm === "" ? true : normalizeText(item.player.name).includes(normalizedSearchTerm),
      ),
    [confirmed, normalizedSearchTerm],
  );

  const filteredCanceled = useMemo(
    () =>
      canceled.filter((item) =>
        normalizedSearchTerm === "" ? true : normalizeText(item.player.name).includes(normalizedSearchTerm),
      ),
    [canceled, normalizedSearchTerm],
  );

  const showPending = listViewFilter === "ALL" || listViewFilter === "PENDING";
  const showConfirmed = listViewFilter === "ALL" || listViewFilter === "CONFIRMED";
  const showCanceled = listViewFilter === "ALL" || listViewFilter === "CANCELED";

  async function loadData() {
    const [playersRes, matchesRes] = await Promise.all([
      fetch("/api/players?active=true"),
      fetch(`/api/matches?from=${getTodayIsoDate()}`),
    ]);

    const players = ((await playersRes.json()) as Player[]).sort((a, b) => a.name.localeCompare(b.name));
    const upcomingMatches = (await matchesRes.json()) as Match[];
    const sortedMatches = upcomingMatches.sort(
      (a, b) => getDateSortValue(a.matchDate) - getDateSortValue(b.matchDate),
    );

    setAllPlayers(players);
    setMatches(sortedMatches);

    setSelectedMatchId((currentSelection) => {
      if (sortedMatches.length === 0) return null;
      if (currentSelection && sortedMatches.some((match) => match.id === currentSelection)) {
        return currentSelection;
      }
      return sortedMatches[0].id;
    });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadData().catch(() => setMessage("Falha ao carregar dados da home."));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!actionMessage) return;

    const timer = window.setTimeout(() => {
      setActionMessage("");
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [actionMessage]);

  async function setPresence(playerId: string, presenceStatus: PresenceStatus) {
    if (!selectedMatch) return;

    const response = await fetch(`/api/matches/${selectedMatch.id}/presence`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId, presenceStatus }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Falha ao atualizar presenca." }));
      setMessage(payload.error ?? "Falha ao atualizar presenca.");
      return;
    }

    setMessage("");
    if (presenceStatus === "CONFIRMED") {
      setActionMessage("Jogador confirmado.");
    } else if (presenceStatus === "CANCELED") {
      setActionMessage("Jogador desconfirmado.");
    } else {
      setActionMessage("Jogador voltou para pendentes.");
    }

    await loadData();
  }

  return (
    <div className="space-y-3 sm:space-y-5">
      <section className="card p-3 sm:p-5">
        {matches.length === 0 || !primaryMatch ? (
          <>
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">Proximas Partidas</p>
            <p className="mt-2 text-sm text-emerald-900">Nenhuma partida em aberto cadastrada.</p>
          </>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.5fr)_minmax(0,1fr)]">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">Proxima Partida</p>
              <div className="mt-2">
                <MatchSummaryCard
                  match={primaryMatch}
                  active={selectedMatchId === primaryMatch.id}
                  onClick={() => setSelectedMatchId(primaryMatch.id)}
                />
              </div>
            </div>

            {otherMatches.length > 0 ? (
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">Outras Partidas</p>

                <div className="mt-2 hidden grid-cols-2 gap-2 xl:grid">
                  {otherMatches.map((match) => (
                    <MatchSummaryCard
                      key={match.id}
                      match={match}
                      active={selectedMatchId === match.id}
                      onClick={() => setSelectedMatchId(match.id)}
                      variant="desktopSecondary"
                    />
                  ))}
                </div>

                <div className="mt-2 flex gap-2 overflow-x-auto pb-1 pr-1 xl:hidden">
                  {otherMatches.map((match) => (
                    <MatchSummaryCard
                      key={match.id}
                      match={match}
                      active={selectedMatchId === match.id}
                      onClick={() => setSelectedMatchId(match.id)}
                      variant="mobileSecondary"
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {selectedMatch ? (
        <section className="card p-3 sm:p-4">
          <label>
            <span className="field-label">Buscar jogador</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                className="field-input"
                type="text"
                placeholder="Digite o nome do jogador..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.currentTarget.value)}
              />
              {searchTerm ? (
                <button type="button" className="btn btn-ghost" onClick={() => setSearchTerm("")}>Limpar</button>
              ) : null}
            </div>
          </label>
        </section>
      ) : null}

      {selectedMatch ? (
        <section className="sticky top-20 z-10 rounded-xl border border-emerald-200 bg-white/95 p-1.5 sm:p-2 backdrop-blur">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn px-2 py-1 text-xs sm:px-4 sm:py-2 sm:text-sm ${listViewFilter === "ALL" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setListViewFilter("ALL")}
            >
              Todos
            </button>
            <button
              type="button"
              className={`btn h-8 w-16 p-0 text-xs sm:h-auto sm:w-auto sm:px-4 sm:py-2 sm:text-sm ${
                listViewFilter === "PENDING"
                  ? "bg-amber-500 text-white hover:bg-amber-600 sm:bg-emerald-700 sm:hover:bg-emerald-800"
                  : "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 sm:border-[#9ecdb4] sm:bg-white sm:text-[#15452f]"
              }`}
              onClick={() => setListViewFilter("PENDING")}
              aria-label="Filtrar pendentes"
            >
              <span className="inline-flex h-8 w-16 items-center justify-center sm:h-auto sm:w-auto">
                <RotateCcw size={14} className="sm:hidden" />
                <span className="hidden sm:inline">Pendentes</span>
              </span>
            </button>
            <button
              type="button"
              className={`btn h-8 w-16 p-0 text-xs sm:h-auto sm:w-auto sm:px-4 sm:py-2 sm:text-sm ${
                listViewFilter === "CONFIRMED"
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 sm:border-[#9ecdb4] sm:bg-white sm:text-[#15452f]"
              }`}
              onClick={() => setListViewFilter("CONFIRMED")}
              aria-label="Filtrar confirmados"
            >
              <span className="inline-flex h-8 w-16 items-center justify-center sm:h-auto sm:w-auto">
                <Check size={14} className="sm:hidden" />
                <span className="hidden sm:inline">Confirmados</span>
              </span>
            </button>
            <button
              type="button"
              className={`btn h-8 w-16 p-0 text-xs sm:h-auto sm:w-auto sm:px-4 sm:py-2 sm:text-sm ${
                listViewFilter === "CANCELED"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 sm:border-[#9ecdb4] sm:bg-white sm:text-[#15452f]"
              }`}
              onClick={() => setListViewFilter("CANCELED")}
              aria-label="Filtrar desconfirmados"
            >
              <span className="inline-flex h-8 w-16 items-center justify-center sm:h-auto sm:w-auto">
                <X size={14} className="sm:hidden" />
                <span className="hidden sm:inline">Desconfirmados</span>
              </span>
            </button>
          </div>
        </section>
      ) : null}

      {selectedMatch && actionMessage ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">{actionMessage}</p>
      ) : null}

      {selectedMatch ? (
        <section className={`grid gap-4 ${listViewFilter === "ALL" ? "md:grid-cols-3" : "md:grid-cols-1"}`}>
          {showPending ? (
            <div className="card p-4">
              <h4 className="text-lg font-semibold text-emerald-900">Pendentes ({filteredPending.length})</h4>
              <ul className="mt-2 space-y-2 text-sm">
                {filteredPending.length === 0 ? (
                  <li className="rounded-lg bg-zinc-50 px-3 py-2 text-emerald-900">
                    Nenhum jogador encontrado para este filtro.
                  </li>
                ) : null}
                {filteredPending.map((player) => (
                  <li
                    key={player.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2"
                  >
                    <span className="font-medium text-emerald-950">{formatPlayerLabel(player)}</span>
                    <div className="flex items-center gap-2">
                      <ActionButton
                        label="Confirmar jogador"
                        tone="green"
                        onClick={() => setPresence(player.id, "CONFIRMED")}
                      >
                        <Check size={16} />
                      </ActionButton>
                      <ActionButton
                        label="Desconfirmar jogador"
                        tone="red"
                        onClick={() => setPresence(player.id, "CANCELED")}
                      >
                        <X size={16} />
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showConfirmed ? (
            <div className="card p-4">
              <h4 className="text-lg font-semibold text-emerald-900">Confirmados ({filteredConfirmed.length})</h4>
              <ul className="mt-2 space-y-2 text-sm">
                {filteredConfirmed.length === 0 ? (
                  <li className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-900">
                    Nenhum jogador encontrado para este filtro.
                  </li>
                ) : null}
                {filteredConfirmed.map((item) => (
                  <li
                    key={item.playerId}
                    className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2"
                  >
                    <span className="font-medium text-emerald-950">{formatPlayerLabel(item.player)}</span>
                    <div className="flex items-center gap-2">
                      <ActionButton
                        label="Voltar jogador para pendentes"
                        tone="yellow"
                        onClick={() => setPresence(item.playerId, "WAITLIST")}
                      >
                        <RotateCcw size={16} />
                      </ActionButton>
                      <ActionButton
                        label="Desconfirmar jogador"
                        tone="red"
                        onClick={() => setPresence(item.playerId, "CANCELED")}
                      >
                        <X size={16} />
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showCanceled ? (
            <div className="card p-4">
              <h4 className="text-lg font-semibold text-emerald-900">Desconfirmados ({filteredCanceled.length})</h4>
              <ul className="mt-2 space-y-2 text-sm">
                {filteredCanceled.length === 0 ? (
                  <li className="rounded-lg bg-red-50 px-3 py-2 text-emerald-900">
                    Nenhum jogador encontrado para este filtro.
                  </li>
                ) : null}
                {filteredCanceled.map((item) => (
                  <li
                    key={item.playerId}
                    className="flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2"
                  >
                    <span className="font-medium text-emerald-950">{formatPlayerLabel(item.player)}</span>
                    <div className="flex items-center gap-2">
                      <ActionButton
                        label="Confirmar jogador"
                        tone="green"
                        onClick={() => setPresence(item.playerId, "CONFIRMED")}
                      >
                        <Check size={16} />
                      </ActionButton>
                      <ActionButton
                        label="Voltar jogador para pendentes"
                        tone="yellow"
                        onClick={() => setPresence(item.playerId, "WAITLIST")}
                      >
                        <RotateCcw size={16} />
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {message ? <p className="text-sm font-medium text-red-700">{message}</p> : null}
    </div>
  );
}
