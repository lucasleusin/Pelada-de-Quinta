"use client";

import { FormEvent, useEffect, useState } from "react";
import { HeroBlock, SectionShell, StatusNote } from "@/components/layout/primitives";
import { formatDatePtBr } from "@/lib/date-format";

type Player = {
  id: string;
  name: string;
  nickname: string | null;
  position: "GOLEIRO" | "ZAGUEIRO" | "MEIA" | "ATACANTE" | "OUTRO";
  shirtNumberPreference: number | null;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  photoPath: string | null;
  isActive: boolean;
};

type PlayerReport = {
  player: {
    id: string;
    name: string;
    photoUrl?: string | null;
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
    avgGoalsPerMatch: number;
    avgAssistsPerMatch: number;
    avgConcededPerMatch: number;
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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "JG";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function toNullableString(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export default function AdminJogadoresPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [position, setPosition] = useState<Player["position"]>("MEIA");
  const [shirtNumberPreference, setShirtNumberPreference] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [reportsByPlayerId, setReportsByPlayerId] = useState<Record<string, PlayerReport>>({});
  const [loadingReportForPlayerId, setLoadingReportForPlayerId] = useState<string | null>(null);

  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [editPosition, setEditPosition] = useState<Player["position"]>("MEIA");
  const [editShirtNumber, setEditShirtNumber] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [photoFilesByPlayerId, setPhotoFilesByPlayerId] = useState<Record<string, File | null>>({});
  const [photoStatusByPlayerId, setPhotoStatusByPlayerId] = useState<Record<string, string>>({});

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
        nickname: toNullableString(nickname),
        position,
        shirtNumberPreference: shirtNumberPreference ? Number(shirtNumberPreference) : null,
        email: toNullableString(email),
        phone: toNullableString(phone),
        isActive: true,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Nao foi possivel criar jogador." }));
      setMessage(payload.error ?? "Nao foi possivel criar jogador.");
      return;
    }

    setName("");
    setNickname("");
    setPosition("MEIA");
    setShirtNumberPreference("");
    setEmail("");
    setPhone("");
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
    setEditNickname(player.nickname ?? "");
    setEditPosition(player.position);
    setEditShirtNumber(player.shirtNumberPreference === null ? "" : String(player.shirtNumberPreference));
    setEditEmail(player.email ?? "");
    setEditPhone(player.phone ?? "");
  }

  function cancelEdit() {
    setEditingPlayerId(null);
    setEditName("");
    setEditNickname("");
    setEditPosition("MEIA");
    setEditShirtNumber("");
    setEditEmail("");
    setEditPhone("");
  }

  async function saveEdit(playerId: string) {
    const response = await fetch(`/api/admin/players/${playerId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: editName,
        nickname: toNullableString(editNickname),
        position: editPosition,
        shirtNumberPreference: editShirtNumber ? Number(editShirtNumber) : null,
        email: toNullableString(editEmail),
        phone: toNullableString(editPhone),
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Falha ao editar jogador." }));
      setMessage(payload.error ?? "Falha ao editar jogador.");
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

  async function uploadPhoto(playerId: string) {
    const file = photoFilesByPlayerId[playerId];

    if (!file) {
      setPhotoStatusByPlayerId((prev) => ({ ...prev, [playerId]: "Selecione um arquivo antes de enviar." }));
      return;
    }

    setPhotoStatusByPlayerId((prev) => ({ ...prev, [playerId]: "Enviando foto..." }));

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/admin/players/${playerId}/photo`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Falha ao enviar foto." }));
      setPhotoStatusByPlayerId((prev) => ({ ...prev, [playerId]: payload.error ?? "Falha ao enviar foto." }));
      return;
    }

    const payload = (await response.json()) as { photoUrl: string | null; photoPath: string | null };

    setPlayers((prev) =>
      prev.map((player) =>
        player.id === playerId ? { ...player, photoUrl: payload.photoUrl, photoPath: payload.photoPath } : player,
      ),
    );
    setPhotoFilesByPlayerId((prev) => ({ ...prev, [playerId]: null }));
    setPhotoStatusByPlayerId((prev) => ({ ...prev, [playerId]: "Foto atualizada." }));
  }

  async function removePhoto(playerId: string) {
    setPhotoStatusByPlayerId((prev) => ({ ...prev, [playerId]: "Removendo foto..." }));

    const response = await fetch(`/api/admin/players/${playerId}/photo`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Falha ao remover foto." }));
      setPhotoStatusByPlayerId((prev) => ({ ...prev, [playerId]: payload.error ?? "Falha ao remover foto." }));
      return;
    }

    setPlayers((prev) =>
      prev.map((player) =>
        player.id === playerId ? { ...player, photoUrl: null, photoPath: null } : player,
      ),
    );
    setPhotoFilesByPlayerId((prev) => ({ ...prev, [playerId]: null }));
    setPhotoStatusByPlayerId((prev) => ({ ...prev, [playerId]: "Foto removida." }));
  }

  return (
    <div className="space-y-4">
      <HeroBlock className="p-5 sm:p-6">
        <h2 className="text-3xl font-bold text-emerald-950">Jogadores</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-7" onSubmit={createPlayer}>
          <label>
            <span className="field-label">Nome</span>
            <input className="field-input" required value={name} onChange={(event) => setName(event.currentTarget.value)} />
          </label>

          <label>
            <span className="field-label">Apelido</span>
            <input className="field-input" value={nickname} onChange={(event) => setNickname(event.currentTarget.value)} />
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

          <label>
            <span className="field-label">Email</span>
            <input
              className="field-input"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
            />
          </label>

          <label>
            <span className="field-label">Telefone</span>
            <input
              className="field-input"
              type="tel"
              placeholder="(51) 99999-9999"
              value={phone}
              onChange={(event) => setPhone(event.currentTarget.value)}
            />
          </label>

          <div className="flex items-end">
            <button className="btn btn-primary w-full" type="submit">
              Criar jogador
            </button>
          </div>
        </form>
      </HeroBlock>

      <SectionShell className="p-4">
        <ul className="space-y-3 text-sm">
          {players.map((player) => {
            const isExpanded = expandedPlayerId === player.id;
            const isEditing = editingPlayerId === player.id;
            const report = reportsByPlayerId[player.id];
            const loadingReport = loadingReportForPlayerId === player.id;

            return (
              <li key={player.id} className="rounded-xl border border-emerald-100 p-3">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid gap-2 md:grid-cols-7 md:items-end">
                      <label>
                        <span className="field-label">Nome</span>
                        <input
                          className="field-input"
                          value={editName}
                          onChange={(event) => setEditName(event.currentTarget.value)}
                        />
                      </label>
                      <label>
                        <span className="field-label">Apelido</span>
                        <input
                          className="field-input"
                          value={editNickname}
                          onChange={(event) => setEditNickname(event.currentTarget.value)}
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
                      <label>
                        <span className="field-label">Email</span>
                        <input
                          className="field-input"
                          type="email"
                          value={editEmail}
                          onChange={(event) => setEditEmail(event.currentTarget.value)}
                        />
                      </label>
                      <label>
                        <span className="field-label">Telefone</span>
                        <input
                          className="field-input"
                          type="tel"
                          value={editPhone}
                          onChange={(event) => setEditPhone(event.currentTarget.value)}
                        />
                      </label>
                      <div className="flex gap-2 md:col-span-6">
                        <button className="btn btn-primary" type="button" onClick={() => saveEdit(player.id)}>
                          Salvar
                        </button>
                        <button className="btn btn-ghost" type="button" onClick={cancelEdit}>
                          Cancelar
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg bg-emerald-50 p-3">
                      <div className="mb-3 flex items-center gap-3">
                        {player.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={player.photoUrl}
                            alt={`Foto de ${player.name}`}
                            className="h-14 w-14 rounded-xl border border-emerald-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-sm font-bold text-emerald-900">
                            {getInitials(player.name)}
                          </div>
                        )}
                        <p className="text-sm font-medium text-emerald-900">Foto do jogador</p>
                      </div>

                      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                        <label>
                          <span className="field-label">Arquivo</span>
                          <input
                            className="field-input"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(event) => {
                              const file = event.currentTarget.files?.[0] ?? null;
                              setPhotoFilesByPlayerId((prev) => ({ ...prev, [player.id]: file }));
                            }}
                          />
                        </label>
                        <button className="btn btn-primary" type="button" onClick={() => uploadPhoto(player.id)}>
                          Enviar foto
                        </button>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          disabled={!player.photoUrl}
                          onClick={() => removePhoto(player.id)}
                        >
                          Remover foto
                        </button>
                      </div>
                      {photoStatusByPlayerId[player.id] ? (
                        <p className="mt-2 text-xs font-medium text-emerald-900">{photoStatusByPlayerId[player.id]}</p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {player.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={player.photoUrl}
                          alt={`Foto de ${player.name}`}
                          className="h-14 w-14 rounded-xl border border-emerald-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-sm font-bold text-emerald-900">
                          {getInitials(player.name)}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-emerald-950">
                          {player.nickname ? `${player.nickname} (${player.name})` : player.name}
                        </p>
                        <p className="text-xs uppercase tracking-[0.12em] text-emerald-700">
                          {positionLabel[player.position]}
                          {player.shirtNumberPreference !== null ? ` | #${player.shirtNumberPreference}` : ""}
                          {player.isActive ? " | Ativo" : " | Inativo"}
                        </p>
                        {player.email || player.phone ? (
                          <p className="text-xs text-emerald-800">
                            {player.email ? `Email: ${player.email}` : ""}
                            {player.email && player.phone ? " | " : ""}
                            {player.phone ? `Telefone: ${player.phone}` : ""}
                          </p>
                        ) : null}
                      </div>
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
                          <p>Media gols: <strong>{report.totals.avgGoalsPerMatch.toFixed(2)}</strong></p>
                          <p>Media assistencias: <strong>{report.totals.avgAssistsPerMatch.toFixed(2)}</strong></p>
                          <p>Media gols sofridos: <strong>{report.totals.avgConcededPerMatch.toFixed(2)}</strong></p>
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
      </SectionShell>

      {message ? <StatusNote tone="neutral">{message}</StatusNote> : null}
    </div>
  );
}

