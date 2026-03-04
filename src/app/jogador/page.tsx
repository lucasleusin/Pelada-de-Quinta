"use client";

import { useEffect, useState } from "react";

type Player = {
  id: string;
  name: string;
  position: string;
};

export default function PlayerIdentityPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("pelada:selectedPlayerId") : null,
  );

  useEffect(() => {
    fetch("/api/players?active=true")
      .then((res) => res.json())
      .then((data) => setPlayers(data))
      .catch(() => setPlayers([]));
  }, []);

  function selectPlayer(playerId: string) {
    localStorage.setItem("pelada:selectedPlayerId", playerId);
    setSelectedId(playerId);
  }

  return (
    <section className="space-y-4">
      <div className="card p-5">
        <h2 className="text-3xl font-bold text-emerald-950">Quem e voce?</h2>
        <p className="text-sm text-emerald-800">Escolha seu nome para usar o app sem senha.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {players.map((player) => {
          const isSelected = player.id === selectedId;
          return (
            <button
              key={player.id}
              type="button"
              onClick={() => selectPlayer(player.id)}
              className={`card p-4 text-left transition ${
                isSelected ? "border-emerald-700 bg-emerald-100" : "hover:border-emerald-400"
              }`}
            >
              <p className="text-base font-semibold text-emerald-950">{player.name}</p>
              <p className="text-xs uppercase tracking-[0.12em] text-emerald-700">{player.position}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
