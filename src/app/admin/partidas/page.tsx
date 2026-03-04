"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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
  status: string;
  teamAName: string;
  teamBName: string;
  teamAScore: number | null;
  teamBScore: number | null;
  participants: Participant[];
};

const statuses = ["DRAFT", "CONFIRMATION_OPEN", "TEAMS_LOCKED", "FINISHED", "ARCHIVED"];

export default function AdminPartidasPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId) ?? null,
    [matches, selectedMatchId],
  );

  async function loadData() {
    const [matchesRes, playersRes] = await Promise.all([
      fetch("/api/admin/matches"),
      fetch("/api/players?active=true"),
    ]);

    const matchesPayload = (await matchesRes.json()) as Match[];
    const playersPayload = (await playersRes.json()) as Player[];

    setMatches(matchesPayload);
    setPlayers(playersPayload);

    if (!selectedMatchId && matchesPayload[0]) {
      setSelectedMatchId(matchesPayload[0].id);
    }
  }

  useEffect(() => {
    loadData().catch(() => setMessage("Falha ao carregar partidas."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setLocation("");
    setMessage("Partida criada.");
    await loadData();
  }

  async function setStatus(status: string) {
    if (!selectedMatch) return;
    const response = await fetch(`/api/admin/matches/${selectedMatch.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      setMessage("Falha ao atualizar status.");
      return;
    }

    setMessage("Status atualizado.");
    await loadData();
  }

  async function saveScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMatch) return;
    const formData = new FormData(event.currentTarget);
    const teamAScore = Number(formData.get("teamAScore"));
    const teamBScore = Number(formData.get("teamBScore"));

    const response = await fetch(`/api/admin/matches/${selectedMatch.id}/score`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        teamAScore: Number.isNaN(teamAScore) ? null : teamAScore,
        teamBScore: Number.isNaN(teamBScore) ? null : teamBScore,
      }),
    });

    if (!response.ok) {
      setMessage("Falha ao salvar placar.");
      return;
    }

    setMessage("Placar atualizado.");
    await loadData();
  }

  async function updateParticipantPresence(playerId: string, presenceStatus: string) {
    if (!selectedMatch) return;

    const response = await fetch(`/api/admin/matches/${selectedMatch.id}/participants/${playerId}/presence`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ presenceStatus }),
    });

    if (!response.ok) {
      setMessage("Falha ao atualizar presenca.");
      return;
    }

    setMessage("Presenca atualizada.");
    await loadData();
  }

  async function updateTeam(playerId: string, team: "A" | "B" | null) {
    if (!selectedMatch) return;

    const response = await fetch(`/api/admin/matches/${selectedMatch.id}/teams`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assignments: [{ playerId, team }] }),
    });

    if (!response.ok) {
      setMessage("Falha ao atualizar time.");
      return;
    }

    setMessage("Times atualizados.");
    await loadData();
  }

  return (
    <div className="space-y-4">
      <section className="card p-5">
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
      </section>

      <section className="card p-4">
        <label className="field-label" htmlFor="match-select">
          Selecione uma partida
        </label>
        <select
          id="match-select"
          className="field-input"
          value={selectedMatchId}
          onChange={(event) => setSelectedMatchId(event.currentTarget.value)}
        >
          <option value="">-- selecione --</option>
          {matches.map((match) => (
            <option key={match.id} value={match.id}>
              {new Date(match.matchDate).toLocaleDateString("pt-BR")} - {match.status}
            </option>
          ))}
        </select>
      </section>

      {selectedMatch ? (
        <>
          <section className="card p-4">
            <h3 className="text-xl font-semibold text-emerald-950">Status da partida</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {statuses.map((status) => (
                <button
                  key={status}
                  className={`btn ${selectedMatch.status === status ? "btn-primary" : "btn-ghost"}`}
                  type="button"
                  onClick={() => setStatus(status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </section>

          <section className="card p-4">
            <h3 className="text-xl font-semibold text-emerald-950">Placar</h3>
            <form className="mt-3 grid gap-2 md:grid-cols-3" onSubmit={saveScore}>
              <input name="teamAScore" type="number" min={0} defaultValue={selectedMatch.teamAScore ?? ""} className="field-input" />
              <input name="teamBScore" type="number" min={0} defaultValue={selectedMatch.teamBScore ?? ""} className="field-input" />
              <button className="btn btn-accent" type="submit">
                Salvar placar
              </button>
            </form>
          </section>

          <section className="card p-4">
            <h3 className="text-xl font-semibold text-emerald-950">Participantes e times</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {players.map((player) => {
                const participant = selectedMatch.participants.find((item) => item.playerId === player.id);
                return (
                  <li key={player.id} className="grid gap-2 rounded-xl border border-emerald-100 p-3 md:grid-cols-4 md:items-center">
                    <span className="font-medium text-emerald-900">{player.name}</span>
                    <select
                      className="field-input"
                      value={participant?.presenceStatus ?? "CANCELED"}
                      onChange={(event) => updateParticipantPresence(player.id, event.currentTarget.value)}
                    >
                      <option value="CONFIRMED">CONFIRMED</option>
                      <option value="WAITLIST">WAITLIST</option>
                      <option value="CANCELED">CANCELED</option>
                    </select>
                    <select
                      className="field-input"
                      value={participant?.team ?? ""}
                      onChange={(event) =>
                        updateTeam(player.id, event.currentTarget.value ? (event.currentTarget.value as "A" | "B") : null)
                      }
                    >
                      <option value="">Sem time</option>
                      <option value="A">Time A</option>
                      <option value="B">Time B</option>
                    </select>
                    <span className="text-xs uppercase tracking-[0.12em] text-emerald-700">
                      {participant?.presenceStatus ?? "CANCELED"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : null}

      {message ? <p className="text-sm font-medium text-emerald-900">{message}</p> : null}
    </div>
  );
}
