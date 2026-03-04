"use client";

import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { formatDatePtBr } from "@/lib/date-format";

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
  teamAName: string;
  teamBName: string;
  teamAScore: number | null;
  teamBScore: number | null;
  participants: Participant[];
};

type TeamColumn = "POOL" | "A" | "B" | "UNCONFIRMED";

function sortByName<T extends { player: { name: string } }>(list: T[]) {
  return [...list].sort((a, b) => a.player.name.localeCompare(b.player.name));
}

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
  const participantByPlayerId = useMemo(
    () => new Map((selectedMatch?.participants ?? []).map((participant) => [participant.playerId, participant])),
    [selectedMatch],
  );

  const confirmedWithoutTeam = useMemo(
    () =>
      sortByName(
        (selectedMatch?.participants ?? []).filter(
          (participant) => participant.presenceStatus === "CONFIRMED" && participant.team === null,
        ),
      ),
    [selectedMatch],
  );

  const teamAPlayers = useMemo(
    () =>
      sortByName(
        (selectedMatch?.participants ?? []).filter(
          (participant) => participant.presenceStatus === "CONFIRMED" && participant.team === "A",
        ),
      ),
    [selectedMatch],
  );

  const teamBPlayers = useMemo(
    () =>
      sortByName(
        (selectedMatch?.participants ?? []).filter(
          (participant) => participant.presenceStatus === "CONFIRMED" && participant.team === "B",
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
        team: null,
        player,
      };
    });

    return sortByName(list.filter((participant) => participant.presenceStatus !== "CONFIRMED"));
  }, [participantByPlayerId, players]);

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
      const payload = await response.json().catch(() => ({ error: "Falha ao salvar placar." }));
      setMessage(payload.error ?? "Falha ao salvar placar.");
      return;
    }

    setMessage("Placar atualizado.");
    await loadData();
  }

  async function assignTeam(playerId: string, column: TeamColumn) {
    if (!selectedMatch) return;

    const targetTeam = column === "POOL" ? null : column;
    const response = await fetch(`/api/admin/matches/${selectedMatch.id}/teams`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assignments: [{ playerId, team: targetTeam }] }),
    });

    if (!response.ok) {
      setMessage("Falha ao mover jogador entre colunas.");
      return;
    }

    await loadData();
  }

  function onPlayerDragStart(event: DragEvent<HTMLDivElement>, playerId: string) {
    event.dataTransfer.setData("text/plain", playerId);
    event.dataTransfer.effectAllowed = "move";
  }

  function onColumnDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function onColumnDrop(event: DragEvent<HTMLElement>, column: TeamColumn) {
    event.preventDefault();
    const playerId = event.dataTransfer.getData("text/plain");
    if (!playerId) return;

    assignTeam(playerId, column).catch(() => setMessage("Falha ao mover jogador."));
  }

  function renderPlayerCard(participant: Participant, column: TeamColumn) {
    const mobileActionClass = "rounded-full border px-2 py-1 text-[11px] font-semibold";
    const statusLabel = participant.presenceStatus === "CANCELED" ? "Desconfirmado" : "Pendente";

    return (
      <div
        key={participant.playerId}
        draggable
        onDragStart={(event) => onPlayerDragStart(event, participant.playerId)}
        className="cursor-move rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-950 shadow-sm"
      >
        <p>{participant.player.name}</p>
        {column === "UNCONFIRMED" ? (
          <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-emerald-700">{statusLabel}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1 md:hidden">
          <button
            type="button"
            disabled={column === "POOL" || column === "UNCONFIRMED"}
            className={`${mobileActionClass} ${column === "POOL" || column === "UNCONFIRMED" ? "border-emerald-300 bg-emerald-100 text-emerald-700" : "border-emerald-200 bg-white text-emerald-900"}`}
            onClick={() => assignTeam(participant.playerId, "POOL")}
          >
            Sem time
          </button>
          <button
            type="button"
            disabled={column === "A"}
            className={`${mobileActionClass} ${column === "A" ? "border-emerald-300 bg-emerald-100 text-emerald-700" : "border-emerald-200 bg-white text-emerald-900"}`}
            onClick={() => assignTeam(participant.playerId, "A")}
          >
            {selectedMatch?.teamAName ?? "Time A"}
          </button>
          <button
            type="button"
            disabled={column === "B"}
            className={`${mobileActionClass} ${column === "B" ? "border-emerald-300 bg-emerald-100 text-emerald-700" : "border-emerald-200 bg-white text-emerald-900"}`}
            onClick={() => assignTeam(participant.playerId, "B")}
          >
            {selectedMatch?.teamBName ?? "Time B"}
          </button>
        </div>
      </div>
    );
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
              {formatDatePtBr(match.matchDate)}
              {match.location ? ` - ${match.location}` : " - Local a definir"}
            </option>
          ))}
        </select>
      </section>

      {selectedMatch ? (
        <>
          <section className="card p-4">
            <h3 className="text-xl font-semibold text-emerald-950">Placar</h3>
            <form className="mt-3 grid gap-2 md:grid-cols-3" onSubmit={saveScore}>
              <label>
                <span className="field-label">{selectedMatch.teamAName}</span>
                <input
                  name="teamAScore"
                  type="number"
                  min={0}
                  defaultValue={selectedMatch.teamAScore ?? ""}
                  className="field-input"
                />
              </label>
              <label>
                <span className="field-label">{selectedMatch.teamBName}</span>
                <input
                  name="teamBScore"
                  type="number"
                  min={0}
                  defaultValue={selectedMatch.teamBScore ?? ""}
                  className="field-input"
                />
              </label>
              <div className="flex items-end">
                <button className="btn btn-accent w-full" type="submit">
                  Salvar placar
                </button>
              </div>
            </form>
          </section>

          <section className="card p-4">
            <h3 className="text-xl font-semibold text-emerald-950">Definicao dos times (drag and drop)</h3>
            <p className="mt-1 text-sm text-emerald-800">
              Arraste jogadores confirmados entre as colunas para montar os times. No celular, use os botoes de mover em cada jogador.
            </p>

            <div className="mt-4 overflow-x-auto">
              <div className="grid min-w-[920px] grid-cols-3 gap-4">
                <section
                  onDragOver={onColumnDragOver}
                  onDrop={(event) => onColumnDrop(event, "POOL")}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"
                >
                  <h4 className="font-semibold text-emerald-950">
                    Confirmados sem time ({confirmedWithoutTeam.length})
                  </h4>
                  <div className="mt-3 space-y-2">
                    {confirmedWithoutTeam.length === 0 ? (
                      <p className="rounded-lg bg-white px-3 py-2 text-sm text-emerald-800">Nenhum jogador confirmado sem time.</p>
                    ) : (
                      confirmedWithoutTeam.map((participant) => renderPlayerCard(participant, "POOL"))
                    )}
                  </div>

                  <div className="mt-4 border-t border-emerald-200 pt-3">
                    <h5 className="font-semibold text-emerald-950">
                      Nao confirmados ({nonConfirmedPlayers.length})
                    </h5>
                    <p className="mt-1 text-xs text-emerald-800">
                      Arraste para Time A/B para confirmar automaticamente.
                    </p>
                    <div className="mt-2 space-y-2">
                      {nonConfirmedPlayers.length === 0 ? (
                        <p className="rounded-lg bg-white px-3 py-2 text-sm text-emerald-800">Nenhum jogador nao confirmado.</p>
                      ) : (
                        nonConfirmedPlayers.map((participant) => renderPlayerCard(participant, "UNCONFIRMED"))
                      )}
                    </div>
                  </div>
                </section>

                <section
                  onDragOver={onColumnDragOver}
                  onDrop={(event) => onColumnDrop(event, "A")}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"
                >
                  <h4 className="font-semibold text-emerald-950">{selectedMatch.teamAName} ({teamAPlayers.length})</h4>
                  <div className="mt-3 space-y-2">
                    {teamAPlayers.length === 0 ? (
                      <p className="rounded-lg bg-white px-3 py-2 text-sm text-emerald-800">Nenhum jogador nesta coluna.</p>
                    ) : (
                      teamAPlayers.map((participant) => renderPlayerCard(participant, "A"))
                    )}
                  </div>
                </section>

                <section
                  onDragOver={onColumnDragOver}
                  onDrop={(event) => onColumnDrop(event, "B")}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"
                >
                  <h4 className="font-semibold text-emerald-950">{selectedMatch.teamBName} ({teamBPlayers.length})</h4>
                  <div className="mt-3 space-y-2">
                    {teamBPlayers.length === 0 ? (
                      <p className="rounded-lg bg-white px-3 py-2 text-sm text-emerald-800">Nenhum jogador nesta coluna.</p>
                    ) : (
                      teamBPlayers.map((participant) => renderPlayerCard(participant, "B"))
                    )}
                  </div>
                </section>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {message ? <p className="text-sm font-medium text-emerald-900">{message}</p> : null}
    </div>
  );
}
