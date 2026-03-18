"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { HeroBlock, SectionShell, StatusNote } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UserRole = "ADMIN" | "PLAYER";
type UserStatus = "PENDING_VERIFICATION" | "PENDING_APPROVAL" | "ACTIVE" | "DISABLED" | "REJECTED";

type LinkedUser = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
} | null;

type ManagedPlayer = {
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
  user: LinkedUser;
};

type NoticeTone = "success" | "error" | "warning" | "neutral";

const positionLabel: Record<ManagedPlayer["position"], string> = {
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

function extractErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (typeof record.error === "string" && record.error.trim()) {
      return record.error;
    }

    if (record.error && typeof record.error === "object") {
      const fieldErrors = (record.error as Record<string, unknown>).fieldErrors;

      if (fieldErrors && typeof fieldErrors === "object") {
        for (const value of Object.values(fieldErrors as Record<string, unknown>)) {
          if (Array.isArray(value)) {
            const firstMessage = value.find((item) => typeof item === "string" && item.trim());

            if (typeof firstMessage === "string") {
              return firstMessage;
            }
          }
        }
      }
    }
  }

  return fallback;
}

function roleLabel(role: UserRole) {
  return role === "ADMIN" ? "Admin" : "Atleta";
}

function statusLabel(status: UserStatus) {
  if (status === "PENDING_VERIFICATION") return "Confirmacao de email";
  if (status === "PENDING_APPROVAL") return "Aguardando aprovacao";
  if (status === "ACTIVE") return "Acesso ativo";
  if (status === "DISABLED") return "Acesso removido";
  return "Cadastro rejeitado";
}

function playerLabel(player: ManagedPlayer) {
  return player.nickname ? `${player.nickname} (${player.name})` : player.name;
}

export default function AdminJogadoresPage() {
  const [players, setPlayers] = useState<ManagedPlayer[]>([]);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [position, setPosition] = useState<ManagedPlayer["position"]>("MEIA");
  const [shirtNumberPreference, setShirtNumberPreference] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<NoticeTone>("neutral");
  const [showInactive, setShowInactive] = useState(false);

  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [editPosition, setEditPosition] = useState<ManagedPlayer["position"]>("MEIA");
  const [editShirtNumber, setEditShirtNumber] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [photoFilesByPlayerId, setPhotoFilesByPlayerId] = useState<Record<string, File | null>>({});
  const [photoStatusByPlayerId, setPhotoStatusByPlayerId] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const sortedPlayers = useMemo(
    () => [...players].sort((left, right) => playerLabel(left).localeCompare(playerLabel(right))),
    [players],
  );
  const activePlayers = useMemo(() => sortedPlayers.filter((player) => player.isActive), [sortedPlayers]);
  const inactivePlayers = useMemo(() => sortedPlayers.filter((player) => !player.isActive), [sortedPlayers]);

  async function loadPlayers() {
    const response = await fetch("/api/admin/players", { cache: "no-store" });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Falha ao carregar jogadores." }));
      throw new Error(extractErrorMessage(payload, "Falha ao carregar jogadores."));
    }

    const payload = (await response.json()) as ManagedPlayer[];
    setPlayers(payload);
  }

  useEffect(() => {
    loadPlayers().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar jogadores.");
      setMessageTone("error");
    });
  }, []);

  async function createPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

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
      setMessage(extractErrorMessage(payload, "Nao foi possivel criar jogador."));
      setMessageTone("error");
      return;
    }

    setName("");
    setNickname("");
    setPosition("MEIA");
    setShirtNumberPreference("");
    setEmail("");
    setPhone("");
    setMessage("Jogador criado.");
    setMessageTone("success");
    await loadPlayers();
  }

  async function toggleActive(player: ManagedPlayer) {
    setLoadingId(player.id);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/players/${player.id}/active`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !player.isActive }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Falha ao atualizar jogador." }));
        throw new Error(extractErrorMessage(payload, "Falha ao atualizar jogador."));
      }

      setMessage(player.isActive ? "Jogador inativado e acesso removido quando vinculado." : "Jogador ativado.");
      setMessageTone("success");
      await loadPlayers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar jogador.");
      setMessageTone("error");
    } finally {
      setLoadingId(null);
    }
  }

  function startEdit(player: ManagedPlayer) {
    setEditingPlayerId(player.id);
    setEditName(player.name);
    setEditNickname(player.nickname ?? "");
    setEditPosition(player.position);
    setEditShirtNumber(player.shirtNumberPreference === null ? "" : String(player.shirtNumberPreference));
    setEditEmail(player.email ?? "");
    setEditPhone(player.phone ?? "");
    setNewPassword("");
    setPasswordStatus("");
  }

  function cancelEdit() {
    setEditingPlayerId(null);
    setEditName("");
    setEditNickname("");
    setEditPosition("MEIA");
    setEditShirtNumber("");
    setEditEmail("");
    setEditPhone("");
    setNewPassword("");
    setPasswordStatus("");
  }

  async function saveEdit(playerId: string) {
    setLoadingId(playerId);
    setMessage("");

    try {
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
        throw new Error(extractErrorMessage(payload, "Falha ao editar jogador."));
      }

      setMessage("Jogador atualizado.");
      setMessageTone("success");
      cancelEdit();
      await loadPlayers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao editar jogador.");
      setMessageTone("error");
    } finally {
      setLoadingId(null);
    }
  }

  async function setExplicitPassword(player: ManagedPlayer) {
    if (!player.user) {
      setPasswordStatus("Sem conta vinculada.");
      return;
    }

    if (newPassword.trim().length < 8) {
      setPasswordStatus("Senha deve ter ao menos 8 caracteres.");
      return;
    }

    setLoadingId(player.id);
    setPasswordStatus("Redefinindo senha...");

    try {
      const response = await fetch(`/api/admin/users/${player.user.id}/password`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Nao foi possivel redefinir a senha." }));
        throw new Error(extractErrorMessage(payload, "Nao foi possivel redefinir a senha."));
      }

      setNewPassword("");
      setPasswordStatus("Senha redefinida com sucesso.");
      setMessage("Senha da conta atualizada.");
      setMessageTone("success");
      await loadPlayers();
    } catch (error) {
      setPasswordStatus(error instanceof Error ? error.message : "Nao foi possivel redefinir a senha.");
      setMessageTone("error");
    } finally {
      setLoadingId(null);
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
      setPhotoStatusByPlayerId((prev) => ({ ...prev, [playerId]: extractErrorMessage(payload, "Falha ao enviar foto.") }));
      return;
    }

    setPhotoFilesByPlayerId((prev) => ({ ...prev, [playerId]: null }));
    setPhotoStatusByPlayerId((prev) => ({ ...prev, [playerId]: "Foto atualizada." }));
    await loadPlayers();
  }

  async function removePhoto(playerId: string) {
    setPhotoStatusByPlayerId((prev) => ({ ...prev, [playerId]: "Removendo foto..." }));

    const response = await fetch(`/api/admin/players/${playerId}/photo`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Falha ao remover foto." }));
      setPhotoStatusByPlayerId((prev) => ({ ...prev, [playerId]: extractErrorMessage(payload, "Falha ao remover foto.") }));
      return;
    }

    setPhotoFilesByPlayerId((prev) => ({ ...prev, [playerId]: null }));
    setPhotoStatusByPlayerId((prev) => ({ ...prev, [playerId]: "Foto removida." }));
    await loadPlayers();
  }

  function renderPlayerRow(player: ManagedPlayer) {
    const isEditing = editingPlayerId === player.id;

    return (
      <li key={player.id} className="rounded-xl border border-emerald-100 p-3">
        {isEditing ? (
          <div className="space-y-4">
            <div className="grid gap-2 md:grid-cols-7 md:items-end">
              <label>
                <span className="field-label">Nome</span>
                <input className="field-input" value={editName} onChange={(event) => setEditName(event.currentTarget.value)} />
              </label>
              <label>
                <span className="field-label">Apelido</span>
                <input className="field-input" value={editNickname} onChange={(event) => setEditNickname(event.currentTarget.value)} />
              </label>
              <label>
                <span className="field-label">Posicao</span>
                <select className="field-input" value={editPosition} onChange={(event) => setEditPosition(event.currentTarget.value as ManagedPlayer["position"])}>
                  <option value="GOLEIRO">Goleiro</option>
                  <option value="ZAGUEIRO">Zagueiro</option>
                  <option value="MEIA">Meia</option>
                  <option value="ATACANTE">Atacante</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </label>
              <label>
                <span className="field-label">Numero</span>
                <input className="field-input" type="number" min={0} max={99} value={editShirtNumber} onChange={(event) => setEditShirtNumber(event.currentTarget.value)} />
              </label>
              <label>
                <span className="field-label">Email do jogador</span>
                <input className="field-input" type="email" value={editEmail} onChange={(event) => setEditEmail(event.currentTarget.value)} />
              </label>
              <label>
                <span className="field-label">Whatsapp</span>
                <input className="field-input" type="tel" value={editPhone} onChange={(event) => setEditPhone(event.currentTarget.value)} />
              </label>
              <div className="flex gap-2 md:col-span-6">
                <button className="btn btn-primary" type="button" disabled={loadingId === player.id} onClick={() => saveEdit(player.id)}>
                  Salvar
                </button>
                <button className="btn btn-ghost" type="button" onClick={cancelEdit}>
                  Cancelar
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-lg bg-emerald-50 p-3">
                <div className="mb-3 flex items-center gap-3">
                  {player.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={player.photoUrl}
                      alt={`Foto de ${player.name}`}
                      className="h-16 w-16 rounded-xl border border-emerald-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-sm font-bold text-emerald-900">
                      {getInitials(player.name)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-emerald-900">Foto do jogador</p>
                    <p className="text-xs text-emerald-700">Atualize a imagem esportiva usada nos cards e listagens.</p>
                  </div>
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
                  <button className="btn btn-ghost" type="button" disabled={!player.photoUrl} onClick={() => removePhoto(player.id)}>
                    Remover foto
                  </button>
                </div>
                {photoStatusByPlayerId[player.id] ? (
                  <p className="mt-2 text-xs font-medium text-emerald-900">{photoStatusByPlayerId[player.id]}</p>
                ) : null}
              </div>

              <div className="rounded-lg border border-emerald-100 bg-white p-3">
                <p className="text-sm font-semibold text-emerald-950">Conta vinculada</p>
                {player.user ? (
                  <>
                    <p className="mt-1 text-sm text-emerald-900">{player.user.email}</p>
                    <p className="text-xs text-emerald-700">
                      {roleLabel(player.user.role)} | {statusLabel(player.user.status)}
                      {player.user.mustChangePassword ? " | Troca de senha pendente" : ""}
                    </p>

                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-emerald-900">Definir nova senha:</p>
                      <input
                        className="field-input"
                        type="password"
                        minLength={8}
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.currentTarget.value)}
                        placeholder="Minimo de 8 caracteres"
                      />
                      <Button className="rounded-full" type="button" disabled={loadingId === player.id} onClick={() => setExplicitPassword(player)}>
                        Redefinir
                      </Button>
                      {passwordStatus ? <p className="text-xs font-medium text-emerald-900">{passwordStatus}</p> : null}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-emerald-800">Sem conta vinculada.</p>
                )}
              </div>
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
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-emerald-950">{playerLabel(player)}</p>
                  {player.user ? (
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]", player.user.status === "ACTIVE" ? "border border-sky-200 bg-sky-50 text-sky-700" : "border border-amber-200 bg-amber-50 text-amber-700")}>
                      {statusLabel(player.user.status)}
                    </span>
                  ) : null}
                  {player.user ? (
                    <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-purple-700">
                      {roleLabel(player.user.role)}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs uppercase tracking-[0.12em] text-emerald-700">
                  {positionLabel[player.position]}
                  {player.shirtNumberPreference !== null ? ` | #${player.shirtNumberPreference}` : ""}
                </p>
                <p className="text-xs text-emerald-800">
                  {player.email ? `Email do jogador: ${player.email}` : "Sem email no jogador"}
                  {player.phone ? ` | Whatsapp: ${player.phone}` : ""}
                </p>
                <p className="text-xs text-emerald-800">
                  {player.user ? `Conta: ${player.user.email}` : "Sem conta vinculada"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="btn btn-ghost" type="button" onClick={() => startEdit(player)}>
                Editar
              </button>
              <Link className="btn btn-ghost" href={`/meu-perfil?playerId=${player.id}&modo=admin`} target="_blank" rel="noreferrer">
                Estatisticas
              </Link>
              <button className="btn btn-ghost" type="button" disabled={loadingId === player.id} onClick={() => toggleActive(player)}>
                {player.isActive ? "Inativar" : "Ativar"}
              </button>
            </div>
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <HeroBlock className="p-5 sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Cadastro esportivo</p>
            <h2 className="mt-1 text-3xl font-bold text-emerald-950">Jogadores</h2>
            <p className="text-sm text-emerald-800">
              Gerencie atletas, acesso vinculado e a administracao de conta em um unico lugar.
            </p>
          </div>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-800 px-4 text-sm font-medium text-white transition hover:bg-zinc-900"
            href="/admin/jogadores/unificar"
          >
            Unificar Jogadores
          </Link>
        </div>

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
            <select className="field-input" value={position} onChange={(event) => setPosition(event.currentTarget.value as ManagedPlayer["position"])}>
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
            <span className="field-label">Whatsapp</span>
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
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-emerald-950">Jogadores ativos</h3>
            <p className="text-sm text-emerald-800">Cada linha concentra os dados esportivos do atleta e a conta vinculada, quando existir.</p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
            {activePlayers.length} jogador{activePlayers.length === 1 ? "" : "es"}
          </p>
        </div>

        <ul className="mt-4 space-y-3 text-sm">
          {activePlayers.map(renderPlayerRow)}
        </ul>
      </SectionShell>

      <SectionShell className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-emerald-950">Jogadores inativos</h3>
            <p className="text-sm text-emerald-800">Historico esportivo preservado, com acesso removido quando houver conta vinculada.</p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
              {inactivePlayers.length} jogador{inactivePlayers.length === 1 ? "" : "es"}
            </p>
            <button className="btn btn-ghost" type="button" onClick={() => setShowInactive((current) => !current)}>
              {showInactive ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>

        {showInactive ? <ul className="mt-4 space-y-3 text-sm">{inactivePlayers.map(renderPlayerRow)}</ul> : null}
      </SectionShell>

      {message ? <StatusNote tone={messageTone}>{message}</StatusNote> : null}
    </div>
  );
}

