"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HeroBlock, SectionShell, StatusNote } from "@/components/layout/primitives";
import { Button, buttonVariants } from "@/components/ui/button";

type UserRole = "ADMIN" | "PLAYER";
type UserStatus = "PENDING_VERIFICATION" | "PENDING_APPROVAL" | "ACTIVE" | "DISABLED" | "REJECTED";
type Position = "GOLEIRO" | "ZAGUEIRO" | "MEIA" | "ATACANTE" | "OUTRO" | null;

type PlayerOption = {
  id: string;
  name: string;
  nickname: string | null;
};

type ManagedUser = {
  id: string;
  name: string | null;
  email: string;
  nickname: string | null;
  position: Position;
  shirtNumberPreference: number | null;
  whatsApp: string | null;
  status: UserStatus;
  role: UserRole;
  playerId: string | null;
  mustChangePassword: boolean;
  createdAt: string;
  emailVerified: string | null;
  player: PlayerOption | null;
};

type UsersPayload = {
  pendingUsers: ManagedUser[];
  activeUsers: ManagedUser[];
  removedUsers: ManagedUser[];
  players: PlayerOption[];
};

type ResetState = {
  user: ManagedUser;
  temporaryPassword: string | null;
  loading: boolean;
  message: string;
  error: string;
};

function playerLabel(player: PlayerOption) {
  return player.nickname ? `${player.nickname} (${player.name})` : player.name;
}

function userLabel(user: ManagedUser) {
  return user.name?.trim() ? user.name : user.email;
}

function statusLabel(status: UserStatus) {
  if (status === "PENDING_VERIFICATION") return "Confirmacao de email";
  if (status === "PENDING_APPROVAL") return "Aguardando aprovacao";
  if (status === "ACTIVE") return "Ativo";
  if (status === "DISABLED") return "Removido";
  return "Rejeitado";
}

function roleLabel(role: UserRole) {
  return role === "ADMIN" ? "Admin" : "Atleta";
}

function removedReason(status: UserStatus) {
  return status === "DISABLED" ? "Removido" : "Rejeitado";
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

export default function AdminUsuariosPage() {
  const [data, setData] = useState<UsersPayload>({
    pendingUsers: [],
    activeUsers: [],
    removedUsers: [],
    players: [],
  });
  const [selectedPlayers, setSelectedPlayers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "warning" | "neutral">("neutral");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [resetState, setResetState] = useState<ResetState | null>(null);

  async function loadData() {
    const response = await fetch("/api/admin/users", { cache: "no-store" });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Falha ao carregar usuarios." }));
      throw new Error(extractErrorMessage(payload, "Falha ao carregar usuarios."));
    }

    const payload = (await response.json()) as UsersPayload;
    setData(payload);
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadData();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Falha ao carregar usuarios.");
        setMessageTone("error");
      }
    })();
  }, []);

  const sortedPlayers = useMemo(
    () => [...data.players].sort((left, right) => playerLabel(left).localeCompare(playerLabel(right))),
    [data.players],
  );

  async function refreshAfterAction(successMessage: string) {
    await loadData();
    setMessage(successMessage);
    setMessageTone("success");
  }

  async function handlePendingAction(userId: string, action: "link" | "create" | "reject") {
    setLoadingId(userId);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/users/${userId}/approval`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          playerId: selectedPlayers[userId] || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Nao foi possivel atualizar o usuario." }));
        throw new Error(extractErrorMessage(payload, "Nao foi possivel atualizar o usuario."));
      }

      await refreshAfterAction("Usuario atualizado com sucesso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel atualizar o usuario.");
      setMessageTone("error");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleRoleChange(user: ManagedUser) {
    const nextRole: UserRole = user.role === "ADMIN" ? "PLAYER" : "ADMIN";
    setLoadingId(user.id);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Nao foi possivel trocar o perfil." }));
        throw new Error(extractErrorMessage(payload, "Nao foi possivel trocar o perfil."));
      }

      await refreshAfterAction(`Perfil atualizado para ${roleLabel(nextRole)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel trocar o perfil.");
      setMessageTone("error");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleStatusChange(userId: string, action: "disable" | "reactivate" | "reopen") {
    setLoadingId(userId);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Nao foi possivel atualizar o acesso." }));
        throw new Error(extractErrorMessage(payload, "Nao foi possivel atualizar o acesso."));
      }

      const successLabel =
        action === "disable" ? "Acesso removido." : action === "reactivate" ? "Acesso reativado." : "Cadastro reaberto.";
      await refreshAfterAction(successLabel);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel atualizar o acesso.");
      setMessageTone("error");
    } finally {
      setLoadingId(null);
    }
  }

  function openResetModal(user: ManagedUser) {
    setResetState({
      user,
      temporaryPassword: null,
      loading: false,
      message: "",
      error: "",
    });
  }

  async function handlePasswordReset(mode: "email" | "temporary") {
    if (!resetState) return;

    setResetState((current) => (current ? { ...current, loading: true, message: "", error: "" } : current));

    try {
      const response = await fetch(`/api/admin/users/${resetState.user.id}/password-reset`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Nao foi possivel reiniciar a senha." }));
        throw new Error(extractErrorMessage(payload, "Nao foi possivel reiniciar a senha."));
      }

      const payload = (await response.json()) as { temporaryPassword?: string };

      if (mode === "email") {
        setResetState(null);
        setMessage("Link de redefinicao enviado por email.");
        setMessageTone("success");
        return;
      }

      setResetState((current) =>
        current
          ? {
              ...current,
              loading: false,
              temporaryPassword: payload.temporaryPassword ?? null,
              message: "Senha temporaria gerada. Copie agora; ela so aparece uma vez.",
              error: "",
            }
          : current,
      );
    } catch (error) {
      setResetState((current) =>
        current
          ? {
              ...current,
              loading: false,
              error: error instanceof Error ? error.message : "Nao foi possivel reiniciar a senha.",
            }
          : current,
      );
    }
  }

  async function copyTemporaryPassword() {
    if (!resetState?.temporaryPassword) return;

    await navigator.clipboard.writeText(resetState.temporaryPassword);
    setResetState((current) =>
      current
        ? {
            ...current,
            message: "Senha temporaria copiada.",
          }
        : current,
    );
  }

  return (
    <div className="space-y-4">
      <HeroBlock className="p-5 sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Acesso</p>
            <h2 className="mt-1 text-3xl font-bold text-emerald-950">Usuarios</h2>
            <p className="text-sm text-emerald-800">
              Gerencie aprovacoes, niveis de acesso, redefinicao de senha e vinculo com os atletas cadastrados.
            </p>
          </div>
          <Link className={buttonVariants({ variant: "outline", className: "rounded-full" })} href="/admin/usuarios/unificar">
            Unificar Jogadores/Usuarios
          </Link>
        </div>
      </HeroBlock>

      <SectionShell className="p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-emerald-950">Usuarios com cadastro pendente</h3>
            <p className="text-sm text-emerald-800">Confirme email, vincule a um jogador existente ou crie um novo atleta.</p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
            {data.pendingUsers.length} usuario{data.pendingUsers.length === 1 ? "" : "s"}
          </p>
        </div>

        {data.pendingUsers.length === 0 ? (
          <p className="mt-4 text-sm text-emerald-800">Nao ha usuarios pendentes.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.pendingUsers.map((user) => (
              <li key={user.id} className="rounded-2xl border border-emerald-100 bg-white p-4">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(240px,0.9fr)_auto] xl:items-center">
                  <div className="space-y-1 text-sm text-emerald-900">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-emerald-950">{userLabel(user)}</p>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                        {statusLabel(user.status)}
                      </span>
                    </div>
                    <p>{user.email}</p>
                    <p className="text-xs text-emerald-700">
                      {user.nickname ? `Apelido: ${user.nickname} | ` : ""}
                      {user.position ? `Posicao: ${user.position} | ` : ""}
                      {user.shirtNumberPreference !== null ? `Numero: ${user.shirtNumberPreference} | ` : ""}
                      {user.whatsApp ? `Whatsapp: ${user.whatsApp}` : "Sem Whatsapp"}
                    </p>
                  </div>

                  <label className="min-w-0">
                    <span className="field-label">Vincular a jogador existente</span>
                    <select
                      className="field-input mt-2"
                      value={selectedPlayers[user.id] ?? ""}
                      onChange={(event) => {
                        const nextPlayerId = event.currentTarget.value;
                        setSelectedPlayers((current) => ({
                          ...current,
                          [user.id]: nextPlayerId,
                        }));
                      }}
                    >
                      <option value="">Selecione...</option>
                      {sortedPlayers.map((player) => (
                        <option key={player.id} value={player.id}>
                          {playerLabel(player)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <Button
                      className="rounded-full"
                      type="button"
                      disabled={loadingId === user.id}
                      onClick={() => handlePendingAction(user.id, "link")}
                    >
                      Vincular
                    </Button>
                    <Button
                      className="rounded-full"
                      type="button"
                      variant="outline"
                      disabled={loadingId === user.id}
                      onClick={() => handlePendingAction(user.id, "create")}
                    >
                      Criar jogador
                    </Button>
                    <Button
                      className="rounded-full border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                      type="button"
                      variant="outline"
                      disabled={loadingId === user.id}
                      onClick={() => handlePendingAction(user.id, "reject")}
                    >
                      Rejeitar
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionShell>

      <SectionShell className="p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-emerald-950">Usuarios ativos</h3>
            <p className="text-sm text-emerald-800">Controle acesso, permissao administrativa e recuperacao de senha.</p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
            {data.activeUsers.length} usuario{data.activeUsers.length === 1 ? "" : "s"}
          </p>
        </div>

        {data.activeUsers.length === 0 ? (
          <p className="mt-4 text-sm text-emerald-800">Nao ha usuarios ativos.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.activeUsers.map((user) => (
              <li key={user.id} className="rounded-2xl border border-emerald-100 bg-white p-4">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                  <div className="space-y-1 text-sm text-emerald-900">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-emerald-950">{userLabel(user)}</p>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                        {roleLabel(user.role)}
                      </span>
                      {user.mustChangePassword ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                          Troca de senha pendente
                        </span>
                      ) : null}
                    </div>
                    <p>{user.email}</p>
                    <p className="text-xs text-emerald-700">
                      Jogador vinculado: {user.player ? playerLabel(user.player) : "Nenhum"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <Button
                      className="rounded-full"
                      type="button"
                      variant="outline"
                      disabled={loadingId === user.id}
                      onClick={() => openResetModal(user)}
                    >
                      Reiniciar senha
                    </Button>
                    <Button
                      className="rounded-full"
                      type="button"
                      variant="outline"
                      disabled={loadingId === user.id}
                      onClick={() => handleRoleChange(user)}
                    >
                      {user.role === "ADMIN" ? "Tornar atleta" : "Tornar admin"}
                    </Button>
                    <Button
                      className="rounded-full border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                      type="button"
                      variant="outline"
                      disabled={loadingId === user.id}
                      onClick={() => handleStatusChange(user.id, "disable")}
                    >
                      Remover acesso
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionShell>

      <SectionShell className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-emerald-950">Usuarios removidos</h3>
            <p className="text-sm text-emerald-800">Lista colapsada por padrao para acesso removido e cadastros rejeitados.</p>
          </div>
          <Button className="rounded-full" type="button" variant="outline" onClick={() => setShowRemoved((current) => !current)}>
            {showRemoved ? "Ocultar removidos" : "Mostrar removidos"}
          </Button>
        </div>

        {showRemoved ? (
          data.removedUsers.length === 0 ? (
            <p className="mt-4 text-sm text-emerald-800">Nao ha usuarios removidos.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.removedUsers.map((user) => (
                <li key={user.id} className="rounded-2xl border border-emerald-100 bg-white p-4">
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                    <div className="space-y-1 text-sm text-emerald-900">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-emerald-950">{userLabel(user)}</p>
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-700">
                          {removedReason(user.status)}
                        </span>
                      </div>
                      <p>{user.email}</p>
                      <p className="text-xs text-emerald-700">
                        Jogador vinculado: {user.player ? playerLabel(user.player) : "Nenhum"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      {user.status === "DISABLED" ? (
                        <Button
                          className="rounded-full"
                          type="button"
                          variant="outline"
                          disabled={loadingId === user.id}
                          onClick={() => handleStatusChange(user.id, "reactivate")}
                        >
                          Reativar acesso
                        </Button>
                      ) : (
                        <Button
                          className="rounded-full"
                          type="button"
                          variant="outline"
                          disabled={loadingId === user.id}
                          onClick={() => handleStatusChange(user.id, "reopen")}
                        >
                          Reabrir cadastro
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </SectionShell>

      {message ? <StatusNote tone={messageTone}>{message}</StatusNote> : null}

      {resetState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/40 p-4">
          <SectionShell className="w-full max-w-lg border border-emerald-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Senha</p>
                <h3 className="mt-1 text-2xl font-bold text-emerald-950">
                  Reiniciar senha de {userLabel(resetState.user)}
                </h3>
                <p className="mt-1 text-sm text-emerald-800">
                  Escolha entre enviar um link por email ou gerar uma senha temporaria com troca obrigatoria no proximo login.
                </p>
              </div>
              <Button className="rounded-full" type="button" variant="outline" onClick={() => setResetState(null)}>
                Fechar
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                className="rounded-full"
                type="button"
                variant="outline"
                disabled={resetState.loading}
                onClick={() => handlePasswordReset("email")}
              >
                Enviar link por email
              </Button>
              <Button
                className="rounded-full"
                type="button"
                disabled={resetState.loading}
                onClick={() => handlePasswordReset("temporary")}
              >
                Gerar senha temporaria
              </Button>
            </div>

            {resetState.temporaryPassword ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">Senha temporaria</p>
                <p className="mt-2 break-all rounded-xl bg-white px-3 py-2 font-mono text-sm text-emerald-950">
                  {resetState.temporaryPassword}
                </p>
                <div className="mt-3 flex justify-end">
                  <Button className="rounded-full" type="button" variant="outline" onClick={copyTemporaryPassword}>
                    Copiar senha
                  </Button>
                </div>
              </div>
            ) : null}

            {resetState.message ? <StatusNote className="mt-4" tone="success">{resetState.message}</StatusNote> : null}
            {resetState.error ? <StatusNote className="mt-4" tone="error">{resetState.error}</StatusNote> : null}
          </SectionShell>
        </div>
      ) : null}
    </div>
  );
}
