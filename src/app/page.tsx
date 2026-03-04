"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  teamAName: string;
  teamBName: string;
  participants: Participant[];
};

export default function HomePage() {
  const [selectedPlayerId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("pelada:selectedPlayerId") : null,
  );
  const [selectedPlayerName, setSelectedPlayerName] = useState<string>("");
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
  const [message, setMessage] = useState<string>("");

  const confirmed = useMemo(
    () => nextMatch?.participants.filter((item) => item.presenceStatus === "CONFIRMED") ?? [],
    [nextMatch],
  );

  const waitlist = useMemo(
    () => nextMatch?.participants.filter((item) => item.presenceStatus === "WAITLIST") ?? [],
    [nextMatch],
  );

  const pending = useMemo(() => {
    const joinedIds = new Set(
      nextMatch?.participants
        .filter((item) => item.presenceStatus !== "CANCELED")
        .map((item) => item.playerId) ?? [],
    );

    return allPlayers.filter((player) => !joinedIds.has(player.id));
  }, [allPlayers, nextMatch]);

  async function loadData() {
    const [playersRes, nextRes] = await Promise.all([
      fetch("/api/players?active=true"),
      fetch("/api/matches/next"),
    ]);

    const players = (await playersRes.json()) as Player[];
    const nextPayload = (await nextRes.json()) as { match: Match | null };

    setAllPlayers(players);
    setNextMatch(nextPayload.match);

    if (selectedPlayerId) {
      setSelectedPlayerName(players.find((player) => player.id === selectedPlayerId)?.name ?? "");
    }
  }

  useEffect(() => {
    loadData().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedPlayerId) {
      setSelectedPlayerName("");
      return;
    }

    const found = allPlayers.find((player) => player.id === selectedPlayerId);
    setSelectedPlayerName(found?.name ?? "");
  }, [selectedPlayerId, allPlayers]);

  async function handlePresence(action: "confirm" | "cancel") {
    if (!nextMatch || !selectedPlayerId) return;

    const endpoint = action === "confirm" ? "confirm" : "cancel";
    const response = await fetch(`/api/matches/${nextMatch.id}/${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: selectedPlayerId }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Erro" }));
      setMessage(payload.error ?? "Nao foi possivel salvar.");
      return;
    }

    setMessage(action === "confirm" ? "Presenca atualizada." : "Presenca cancelada.");
    await loadData();
  }

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Proxima Quinta</p>
        {nextMatch ? (
          <>
            <h2 className="text-3xl font-bold text-emerald-950">
              {new Date(nextMatch.matchDate).toLocaleDateString("pt-BR")}
            </h2>
            <p className="text-sm text-emerald-800">
              {nextMatch.startTime} {nextMatch.location ? `| ${nextMatch.location}` : "| Local a definir"}
            </p>
            <p className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              Status: {nextMatch.status}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="btn btn-primary"
                onClick={() => handlePresence("confirm")}
                disabled={!selectedPlayerId}
              >
                Confirmar presenca
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => handlePresence("cancel")}
                disabled={!selectedPlayerId}
              >
                Cancelar
              </button>
              <Link className="btn btn-accent" href={`/partidas/${nextMatch.id}/pos-jogo`}>
                Pos-jogo
              </Link>
            </div>
          </>
        ) : (
          <p className="text-sm text-emerald-900">Nenhuma partida futura cadastrada.</p>
        )}
      </section>

      <section className="card p-5">
        <h3 className="text-xl font-semibold text-emerald-950">Jogador selecionado</h3>
        {selectedPlayerId ? (
          <p className="mt-2 text-emerald-800">{selectedPlayerName || "Jogador"}</p>
        ) : (
          <p className="mt-2 text-emerald-800">Selecione quem voce e para confirmar presenca.</p>
        )}
        <Link href="/jogador" className="btn btn-ghost mt-3 inline-flex">
          Alterar jogador
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-4">
          <h4 className="text-lg font-semibold text-emerald-900">Confirmados ({confirmed.length})</h4>
          <ul className="mt-2 space-y-2 text-sm">
            {confirmed.map((item) => (
              <li key={item.playerId} className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                <span>{item.player.name}</span>
                <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-xs">
                  {item.team ?? "Sem time"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-4">
          <h4 className="text-lg font-semibold text-emerald-900">Lista de espera ({waitlist.length})</h4>
          <ul className="mt-2 space-y-2 text-sm">
            {waitlist.map((item) => (
              <li key={item.playerId} className="rounded-lg bg-orange-50 px-3 py-2">
                {item.player.name}
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-4">
          <h4 className="text-lg font-semibold text-emerald-900">Pendentes ({pending.length})</h4>
          <ul className="mt-2 max-h-56 space-y-2 overflow-auto text-sm">
            {pending.map((item) => (
              <li key={item.id} className="rounded-lg bg-zinc-50 px-3 py-2">
                {item.name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {message ? <p className="text-sm font-medium text-emerald-900">{message}</p> : null}
    </div>
  );
}
