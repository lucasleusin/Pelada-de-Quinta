"use client";

import { FormEvent, useEffect, useState } from "react";

type Player = {
  id: string;
  name: string;
  position: string;
  shirtNumberPreference: number | null;
  isActive: boolean;
};

export default function AdminJogadoresPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("MEIA");
  const [shirtNumberPreference, setShirtNumberPreference] = useState("");
  const [message, setMessage] = useState("");

  async function loadPlayers() {
    const response = await fetch("/api/players?active=true");
    const activePlayers = (await response.json()) as Player[];
    const inactiveResponse = await fetch("/api/players?active=false");
    const inactivePlayers = (await inactiveResponse.json()) as Player[];
    setPlayers([...activePlayers, ...inactivePlayers]);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPlayers().catch(() => undefined);
  }, []);

  async function createPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/players", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        position,
        shirtNumberPreference: shirtNumberPreference ? Number(shirtNumberPreference) : null,
        isActive: true,
      }),
    });

    if (!response.ok) {
      setMessage("Nao foi possivel criar jogador.");
      return;
    }

    setName("");
    setPosition("MEIA");
    setShirtNumberPreference("");
    setMessage("Jogador criado.");
    await loadPlayers();
  }

  async function toggleActive(player: Player) {
    const response = await fetch(`/api/admin/players/${player.id}/active`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !player.isActive }),
    });

    if (!response.ok) {
      setMessage("Falha ao atualizar jogador.");
      return;
    }

    setMessage("Status atualizado.");
    await loadPlayers();
  }

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="text-3xl font-bold text-emerald-950">Jogadores</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-4" onSubmit={createPlayer}>
          <label>
            <span className="field-label">Nome</span>
            <input className="field-input" required value={name} onChange={(event) => setName(event.currentTarget.value)} />
          </label>

          <label>
            <span className="field-label">Posicao</span>
            <select className="field-input" value={position} onChange={(event) => setPosition(event.currentTarget.value)}>
              <option value="GOLEIRO">Goleiro</option>
              <option value="ZAGUEIRO">Zagueiro</option>
              <option value="MEIA">Meia</option>
              <option value="ATACANTE">Atacante</option>
              <option value="OUTRO">Outro</option>
            </select>
          </label>

          <label>
            <span className="field-label">Numero</span>
            <input
              className="field-input"
              type="number"
              min={0}
              max={99}
              value={shirtNumberPreference}
              onChange={(event) => setShirtNumberPreference(event.currentTarget.value)}
            />
          </label>

          <div className="flex items-end">
            <button className="btn btn-primary w-full" type="submit">
              Criar jogador
            </button>
          </div>
        </form>
      </section>

      <section className="card p-4">
        <ul className="space-y-2 text-sm">
          {players.map((player) => (
            <li key={player.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-100 p-3">
              <div>
                <p className="font-semibold text-emerald-950">{player.name}</p>
                <p className="text-xs uppercase tracking-[0.12em] text-emerald-700">
                  {player.position} {player.shirtNumberPreference !== null ? `| #${player.shirtNumberPreference}` : ""}
                </p>
              </div>
              <button className="btn btn-ghost" type="button" onClick={() => toggleActive(player)}>
                {player.isActive ? "Inativar" : "Ativar"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {message ? <p className="text-sm font-medium text-emerald-900">{message}</p> : null}
    </div>
  );
}
