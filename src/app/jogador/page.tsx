"use client";

import { useEffect, useState } from "react";
import { HeroBlock, PageShell, SectionShell } from "@/components/layout/primitives";

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
    fetch("/api/players?active=true&publicSelectable=true")
      .then((res) => res.json())
      .then((data) => setPlayers(data))
      .catch(() => setPlayers([]));
  }, []);

  function selectPlayer(playerId: string) {
    localStorage.setItem("pelada:selectedPlayerId", playerId);
    setSelectedId(playerId);
  }

  return (
    <PageShell>
      <HeroBlock className="p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Identidade</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Quem e voce?</h2>
        <p className="text-sm text-emerald-800">Escolha seu nome para usar o app sem senha.</p>
      </HeroBlock>

      <SectionShell className="p-4 sm:p-5">
        {players.length === 0 ? (
          <p className="empty-state text-sm">Nenhum jogador ativo encontrado.</p>
        ) : (
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
        )}
      </SectionShell>
    </PageShell>
  );
}
