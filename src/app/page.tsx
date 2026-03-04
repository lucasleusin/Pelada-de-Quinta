"use client";

import { Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useEffect } from "react";

type Player = {
  id: string;
  name: string;
};

type Participant = {
  playerId: string;
  presenceStatus: "CONFIRMED" | "WAITLIST" | "CANCELED";
  team: "A" | "B" | null;
  player: Player;
};

type Match = {
  id: string;
  matchDate: string;
  location: string | null;
  startTime: string;
  status: string;
  participants: Participant[];
};

function getTomorrowIsoDate() {
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

export default function HomePage() {
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [expandedPendingId, setExpandedPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId) ?? null,
    [matches, selectedMatchId],
  );

  const confirmed = useMemo(
    () =>
      [...(selectedMatch?.participants.filter((item) => item.presenceStatus === "CONFIRMED") ?? [])].sort((a, b) =>
        a.player.name.localeCompare(b.player.name),
      ),
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

  async function loadData(keepSelection = true) {
    const [playersRes, matchesRes] = await Promise.all([
      fetch("/api/players?active=true"),
      fetch(`/api/matches?from=${getTomorrowIsoDate()}`),
    ]);

    const players = ((await playersRes.json()) as Player[]).sort((a, b) => a.name.localeCompare(b.name));
    const upcomingMatches = (await matchesRes.json()) as Match[];
    const sortedMatches = upcomingMatches
      .filter((match) => match.status !== "ARCHIVED")
      .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());

    setAllPlayers(players);
    setMatches(sortedMatches);

    if (!keepSelection && sortedMatches.length > 0) {
      setSelectedMatchId(null);
      return;
    }

    if (selectedMatchId && !sortedMatches.some((match) => match.id === selectedMatchId)) {
      setSelectedMatchId(null);
    }
  }

  useEffect(() => {
    loadData(false).catch(() => setMessage("Falha ao carregar dados da home."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setPresence(playerId: string, presenceStatus: "CONFIRMED" | "CANCELED") {
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

    setExpandedPendingId(null);
    setMessage(presenceStatus === "CONFIRMED" ? "Jogador confirmado." : "Jogador desconfirmado.");
    await loadData(true);
  }

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Proximas Partidas</p>
        {matches.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-900">Nenhuma partida futura cadastrada.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {matches.map((match) => {
              const active = match.id === selectedMatchId;
              return (
                <li key={match.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedMatchId(match.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-emerald-700 bg-emerald-100"
                        : "border-emerald-200 bg-white hover:border-emerald-400"
                    }`}
                  >
                    <p className="text-base font-semibold text-emerald-950">
                      {new Date(match.matchDate).toLocaleDateString("pt-BR")}
                    </p>
                    <p className="text-xs uppercase tracking-[0.1em] text-emerald-700">
                      {match.startTime} {match.location ? `| ${match.location}` : "| Local a definir"} | {match.status}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selectedMatch ? (
        <section className="grid gap-4 md:grid-cols-3">
          <div className="card p-4">
            <h4 className="text-lg font-semibold text-emerald-900">Pendentes ({pending.length})</h4>
            <ul className="mt-2 space-y-2 text-sm">
              {pending.map((player) => (
                <li key={player.id} className="rounded-lg bg-zinc-50 px-3 py-2">
                  <button
                    type="button"
                    className="w-full text-left font-medium text-emerald-950"
                    onClick={() => setExpandedPendingId((current) => (current === player.id ? null : player.id))}
                  >
                    {player.name}
                  </button>

                  {expandedPendingId === player.id ? (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-full bg-emerald-600 p-1.5 text-white hover:bg-emerald-700"
                        onClick={() => setPresence(player.id, "CONFIRMED")}
                        aria-label="Confirmar jogador"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-red-600 p-1.5 text-white hover:bg-red-700"
                        onClick={() => setPresence(player.id, "CANCELED")}
                        aria-label="Desconfirmar jogador"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-4">
            <h4 className="text-lg font-semibold text-emerald-900">Confirmados ({confirmed.length})</h4>
            <ul className="mt-2 space-y-2 text-sm">
              {confirmed.map((item) => (
                <li key={item.playerId} className="rounded-lg bg-emerald-50 px-3 py-2">
                  {item.player.name}
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-4">
            <h4 className="text-lg font-semibold text-emerald-900">Desconfirmados ({canceled.length})</h4>
            <ul className="mt-2 space-y-2 text-sm">
              {canceled.map((item) => (
                <li key={item.playerId} className="rounded-lg bg-red-50 px-3 py-2">
                  {item.player.name}
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
