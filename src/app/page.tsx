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
      ? "rounded-full bg-emerald-600 p-1.5 text-white hover:bg-emerald-700"
      : tone === "red"
        ? "rounded-full bg-red-600 p-1.5 text-white hover:bg-red-700"
        : "rounded-full bg-amber-400 p-1.5 text-white hover:bg-amber-500";

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
  compact = false,
}: {
  match: Match;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
        active
          ? "border-emerald-700 bg-emerald-100"
          : "border-emerald-200 bg-white hover:border-emerald-400"
      } ${compact ? "min-w-[220px] snap-start" : ""}`}
    >
      <p className="text-base font-semibold text-emerald-950">{formatDatePtBr(match.matchDate)}</p>
      <p className="text-xs uppercase tracking-[0.1em] text-emerald-700">
        {match.startTime} {match.location ? `| ${match.location}` : "| Local a definir"}
      </p>
    </button>
  );
}

export default function HomePage() {
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId) ?? null,
    [matches, selectedMatchId],
  );

  const otherMatches = useMemo(
    () => matches.filter((match) => match.id !== selectedMatchId),
    [matches, selectedMatchId],
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

    if (presenceStatus === "CONFIRMED") {
      setMessage("Jogador confirmado.");
    } else if (presenceStatus === "CANCELED") {
      setMessage("Jogador desconfirmado.");
    } else {
      setMessage("Jogador retornou para pendentes.");
    }

    await loadData();
  }

  return (
    <div className="space-y-5">
      <section className="card p-5">
        {matches.length === 0 || !selectedMatch ? (
          <>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Proximas Partidas</p>
            <p className="mt-2 text-sm text-emerald-900">Nenhuma partida em aberto cadastrada.</p>
          </>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Proxima Partida</p>
              <div className="mt-3">
                <MatchSummaryCard
                  match={selectedMatch}
                  active
                  onClick={() => setSelectedMatchId(selectedMatch.id)}
                />
              </div>
            </div>

            {otherMatches.length > 0 ? (
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Outras Partidas</p>

                <div className="mt-3 hidden space-y-2 xl:block">
                  {otherMatches.map((match) => (
                    <MatchSummaryCard
                      key={match.id}
                      match={match}
                      active={false}
                      onClick={() => setSelectedMatchId(match.id)}
                    />
                  ))}
                </div>

                <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1 xl:hidden">
                  {otherMatches.map((match) => (
                    <MatchSummaryCard
                      key={match.id}
                      match={match}
                      active={false}
                      onClick={() => setSelectedMatchId(match.id)}
                      compact
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {selectedMatch ? (
        <section className="grid gap-4 md:grid-cols-3">
          <div className="card p-4">
            <h4 className="text-lg font-semibold text-emerald-900">Pendentes ({pending.length})</h4>
            <ul className="mt-2 space-y-2 text-sm">
              {pending.map((player) => (
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

          <div className="card p-4">
            <h4 className="text-lg font-semibold text-emerald-900">Confirmados ({confirmed.length})</h4>
            <ul className="mt-2 space-y-2 text-sm">
              {confirmed.map((item) => (
                <li
                  key={item.playerId}
                  className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2"
                >
                  <span className="font-medium text-emerald-950">{formatPlayerLabel(item.player)}</span>
                  <div className="flex items-center gap-2">
                    <ActionButton
                      label="Desconfirmar jogador"
                      tone="red"
                      onClick={() => setPresence(item.playerId, "CANCELED")}
                    >
                      <X size={16} />
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

          <div className="card p-4">
            <h4 className="text-lg font-semibold text-emerald-900">Desconfirmados ({canceled.length})</h4>
            <ul className="mt-2 space-y-2 text-sm">
              {canceled.map((item) => (
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
        </section>
      ) : null}

      {message ? <p className="text-sm font-medium text-emerald-900">{message}</p> : null}
    </div>
  );
}
