"use client";

import { FormEvent, useEffect, useState } from "react";
import { formatDatePtBr } from "@/lib/date-format";

type Player = {
  id: string;
  name: string;
  position: "GOLEIRO" | "ZAGUEIRO" | "MEIA" | "ATACANTE" | "OUTRO";
  shirtNumberPreference: number | null;
  isActive: boolean;
};

type PlayerReport = {
  player: {
    id: string;
    name: string;
  };
  totals: {
    matches: number;
    goals: number;
    assists: number;
    goalsConceded: number;
    avgRating: number;
    ratingsCount: number;
    wins: number;
    losses: number;
    draws: number;
    goalsPerMatch: number;
    efficiency: number;
  };
  history: Array<{
    goals: number;
    assists: number;
    goalsConceded: number;
    match: {
      id: string;
      matchDate: string;
      teamAScore: number | null;
      teamBScore: number | null;
      teamAName: string;
      teamBName: string;
    };
  }>;
};

const positionLabel: Record<Player["position"], string> = {
  GOLEIRO: "Goleiro",
  ZAGUEIRO: "Zagueiro",
  MEIA: "Meia",
  ATACANTE: "Atacante",
  OUTRO: "Outro",
};

export default function AdminJogadoresPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [position, setPosition] = useState<Player["position"]>("MEIA");
  const [shirtNumberPreference, setShirtNumberPreference] = useState("");
  const [message, setMessage] = useState("");

  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [reportsByPlayerId, setReportsByPlayerId] = useState<Record<string, PlayerReport>>({});
  const [loadingReportForPlayerId, setLoadingReportForPlayerId] = useState<string | null>(null);

  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPosition, setEditPosition] = useState<Player["position"]>("MEIA");
  const [editShirtNumber, setEditShirtNumber] = useState("");

  async function loadPlayers() {
    const response = await fetch("/api/players");
    const payload = (await response.json()) as Player[];
    setPlayers(payload);
  }

  useEffect(() => {
    loadPlayers().catch(() => setMessage("Falha ao carregar jogadores."));
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

    setMessage(player.isActive ? "Jogador inativado." : "Jogador ativado.");
    await loadPlayers();
  }

  function startEdit(player: Player) {
    setEditingPlayerId(player.id);
    setEditName(player.name);
    setEditPosition(player.position);
    setEditShirtNumber(player.shirtNumberPreference === null ? "" : String(player.shirtNumberPreference));
  }

  function cancelEdit() {
    setEditingPlayerId(null);
    setEditName("");
    setEditPosition("MEIA");
    setEditShirtNumber("");
  }

  async function saveEdit(playerId: string) {
    const response = await fetch(`/api/admin/players/${playerId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: editName,
        position: editPosition,
        shirtNumberPreference: editShirtNumber ? Number(editShirtNumber) : null,
      }),
    });

    if (!response.ok) {
      setMessage("Falha ao editar jogador.");
      return;
    }

    setMessage("Jogador atualizado.");
    cancelEdit();
    await loadPlayers();
  }

  async function toggleDetails(player: Player) {
    setExpandedPlayerId((current) => (current === player.id ? null : player.id));

    if (reportsByPlayerId[player.id]) return;

    setLoadingReportForPlayerId(player.id);
    try {
      const response = await fetch(`/api/admin/reports/player/${player.id}`);
      if (!response.ok) {
        setMessage("Nao foi possivel carregar as estatisticas do jogador.");
        return;
      }

      const report = (await response.json()) as PlayerReport;
      setReportsByPlayerId((prev) => ({
        ...prev,
        [player.id]: report,
      }));
    } finally {
      setLoadingReportForPlayerId(null);
    }
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
            <select className="field-input" value={position} onChange={(event) => setPosition(event.currentTarget.value as Player["position"])}>
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
        <ul className="space-y-3 text-sm">
          {players.map((player) => {
            const isExpanded = expandedPlayerId === player.id;
            const isEditing = editingPlayerId === player.id;
            const report = reportsByPlayerId[player.id];
            const loadingReport = loadingReportForPlayerId === player.id;

            return (
              <li key={player.id} className="rounded-xl border border-emerald-100 p-3">
                {isEditing ? (
                  <div className="grid gap-2 md:grid-cols-4 md:items-end">
                    <label>
                      <span className="field-label">Nome</span>
                      <input
                        className="field-input"
                        value={editName}
                        onChange={(event) => setEditName(event.currentTarget.value)}
                      />
                    </label>
                    <label>
                      <span className="field-label">Posicao</span>
                      <select
                        className="field-input"
                        value={editPosition}
                        onChange={(event) => setEditPosition(event.currentTarget.value as Player["position"])}
                      >
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
                        value={editShirtNumber}
                        onChange={(event) => setEditShirtNumber(event.currentTarget.value)}
                      />
                    </label>
                    <div className="flex gap-2">
                      <button className="btn btn-primary" type="button" onClick={() => saveEdit(player.id)}>
                        Salvar
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={cancelEdit}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-emerald-950">{player.name}</p>
                      <p className="text-xs uppercase tracking-[0.12em] text-emerald-700">
                        {positionLabel[player.position]}
                        {player.shirtNumberPreference !== null ? ` | #${player.shirtNumberPreference}` : ""}
                        {player.isActive ? " | Ativo" : " | Inativo"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button className="btn btn-ghost" type="button" onClick={() => startEdit(player)}>
                        Editar
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => toggleDetails(player)}>
                        {isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => toggleActive(player)}>
                        {player.isActive ? "Inativar" : "Ativar"}
                      </button>
                    </div>
                  </div>
                )}

                {isExpanded ? (
                  <div className="mt-3 rounded-lg bg-emerald-50 p-3">
                    {loadingReport ? (
                      <p className="text-sm text-emerald-900">Carregando estatisticas...</p>
                    ) : report ? (
                      <div className="space-y-3">
                        <div className="grid gap-2 text-sm md:grid-cols-3 lg:grid-cols-6">
                          <p>Partidas: <strong>{report.totals.matches}</strong></p>
                          <p>Gols: <strong>{report.totals.goals}</strong></p>
                          <p>Assistencias: <strong>{report.totals.assists}</strong></p>
                          <p>Gols sofridos: <strong>{report.totals.goalsConceded}</strong></p>
                          <p>Vitorias: <strong>{report.totals.wins}</strong></p>
                          <p>Derrotas: <strong>{report.totals.losses}</strong></p>
                          <p>Empates: <strong>{report.totals.draws}</strong></p>
                          <p>Media gol/jogo: <strong>{report.totals.goalsPerMatch.toFixed(2)}</strong></p>
                          <p>Aproveitamento: <strong>{report.totals.efficiency.toFixed(1)}%</strong></p>
                          <p>Nota media: <strong>{report.totals.avgRating.toFixed(2)}</strong></p>
                          <p>Avaliacoes: <strong>{report.totals.ratingsCount}</strong></p>
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-emerald-900">Historico por partida</p>
                          <ul className="mt-2 space-y-2 text-sm">
                            {report.history.length === 0 ? (
                              <li className="rounded-lg bg-white p-2">Sem partidas registradas.</li>
                            ) : (
                              report.history.map((item) => (
                                <li key={item.match.id} className="rounded-lg bg-white p-2">
                                  <p className="font-medium text-emerald-900">
                                    {formatDatePtBr(item.match.matchDate)} -{" "}
                                    {item.match.teamAName} {item.match.teamAScore ?? "-"} x{" "}
                                    {item.match.teamBScore ?? "-"} {item.match.teamBName}
                                  </p>
                                  <p>
                                    Gols: {item.goals} | Assistencias: {item.assists} | Gols sofridos:{" "}
                                    {item.goalsConceded}
                                  </p>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-emerald-900">Nao ha estatisticas para este jogador.</p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {message ? <p className="text-sm font-medium text-emerald-900">{message}</p> : null}
    </div>
  );
}
