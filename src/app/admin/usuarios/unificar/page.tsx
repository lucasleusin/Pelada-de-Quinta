"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HeroBlock, SectionShell, StatusNote } from "@/components/layout/primitives";
import { Button, buttonVariants } from "@/components/ui/button";

type UserRole = "ADMIN" | "PLAYER";
type UserStatus = "PENDING_VERIFICATION" | "PENDING_APPROVAL" | "ACTIVE" | "DISABLED" | "REJECTED";

type MergeCandidateUser = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  status: UserStatus;
  playerId: string | null;
  player: {
    id: string;
    name: string;
    nickname: string | null;
  } | null;
  loginMethods: string[];
  createdAt: string;
};

type MergeCandidatePlayer = {
  id: string;
  name: string;
  nickname: string | null;
  email: string | null;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    status: UserStatus;
    playerId: string | null;
  } | null;
};

type MergeCandidatesPayload = {
  users: MergeCandidateUser[];
  players: MergeCandidatePlayer[];
};

type MergePreview = {
  userMerge: null | {
    primary: {
      id: string;
      label: string;
      email: string;
      role: UserRole;
      status: UserStatus;
      playerLabel: string | null;
    };
    secondary: {
      id: string;
      label: string;
      email: string;
      role: UserRole;
      status: UserStatus;
      playerLabel: string | null;
      loginMethods: string[];
    };
    result: {
      role: UserRole;
      status: UserStatus;
      passwordAction: "keep-primary" | "move-secondary" | "none";
      finalEmail: string;
    };
  };
  playerMerge: null | {
    primary: {
      id: string;
      label: string;
      email: string | null;
    };
    secondary: {
      id: string;
      label: string;
      email: string | null;
    };
    summary: {
      participants: number;
      overlappingMatches: number;
      ratingsGiven: number;
      ratingsReceived: number;
      whatsAppMessages: number;
    };
  };
  warnings: string[];
};

type MergeForm = {
  primaryUserId: string;
  secondaryUserId: string;
  primaryPlayerId: string;
  secondaryPlayerId: string;
};

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
  if (status === "ACTIVE") return "Ativo";
  if (status === "DISABLED") return "Removido";
  return "Rejeitado";
}

function playerLabel(player: { name: string; nickname: string | null }) {
  return player.nickname ? `${player.nickname} (${player.name})` : player.name;
}

function userLabel(user: { name: string | null; email: string }) {
  return user.name?.trim() ? user.name : user.email;
}

function passwordActionLabel(action: "keep-primary" | "move-secondary" | "none") {
  if (action === "move-secondary") return "A senha local da conta secundaria sera movida para a principal.";
  if (action === "keep-primary") return "A senha local da conta principal sera mantida.";
  return "Nenhuma senha local sera carregada para a conta final.";
}

export default function AdminUsuariosUnificarPage() {
  const [candidates, setCandidates] = useState<MergeCandidatesPayload>({ users: [], players: [] });
  const [form, setForm] = useState<MergeForm>({
    primaryUserId: "",
    secondaryUserId: "",
    primaryPlayerId: "",
    secondaryPlayerId: "",
  });
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "warning" | "neutral">("neutral");

  async function loadCandidates() {
    const response = await fetch("/api/admin/users/merge", { cache: "no-store" });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Falha ao carregar candidatos." }));
      throw new Error(extractErrorMessage(payload, "Falha ao carregar candidatos."));
    }

    const payload = (await response.json()) as MergeCandidatesPayload;
    setCandidates(payload);
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadCandidates();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Falha ao carregar candidatos.");
        setMessageTone("error");
      }
    })();
  }, []);

  const userOptions = useMemo(
    () => [...candidates.users].sort((left, right) => userLabel(left).localeCompare(userLabel(right))),
    [candidates.users],
  );
  const playerOptions = useMemo(
    () => [...candidates.players].sort((left, right) => playerLabel(left).localeCompare(playerLabel(right))),
    [candidates.players],
  );

  const selectedPrimaryUser = userOptions.find((user) => user.id === form.primaryUserId) ?? null;
  const selectedSecondaryUser = userOptions.find((user) => user.id === form.secondaryUserId) ?? null;
  const selectedPrimaryPlayer = playerOptions.find((player) => player.id === form.primaryPlayerId) ?? null;
  const selectedSecondaryPlayer = playerOptions.find((player) => player.id === form.secondaryPlayerId) ?? null;

  function updateForm<K extends keyof MergeForm>(key: K, value: MergeForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setPreview(null);
    setAcknowledged(false);
    setMessage("");
  }

  async function requestPreview() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/users/merge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          ...form,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Nao foi possivel gerar o resumo." }));
        throw new Error(extractErrorMessage(payload, "Nao foi possivel gerar o resumo."));
      }

      const payload = (await response.json()) as MergePreview;
      setPreview(payload);
      setMessage("Resumo carregado. Revise com cuidado antes de confirmar.");
      setMessageTone("warning");
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : "Nao foi possivel gerar o resumo.");
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }

  async function executeMerge() {
    if (!acknowledged) {
      setMessage("Confirme que entende o impacto irreversivel antes de unificar.");
      setMessageTone("warning");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/users/merge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "execute",
          ...form,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Nao foi possivel concluir a unificacao." }));
        throw new Error(extractErrorMessage(payload, "Nao foi possivel concluir a unificacao."));
      }

      await loadCandidates();
      setForm({
        primaryUserId: "",
        secondaryUserId: "",
        primaryPlayerId: "",
        secondaryPlayerId: "",
      });
      setPreview(null);
      setAcknowledged(false);
      setMessage("Unificacao concluida com sucesso.");
      setMessageTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel concluir a unificacao.");
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <HeroBlock className="p-5 sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Acesso</p>
            <h2 className="mt-1 text-3xl font-bold text-emerald-950">Unificar Jogadores/Usuarios</h2>
            <p className="text-sm text-emerald-800">
              Ferramenta administrativa para consolidar duplicidades de conta e historico esportivo em um registro principal.
            </p>
          </div>
          <Link className={buttonVariants({ variant: "outline", className: "rounded-full" })} href="/admin/usuarios">
            Voltar para Usuarios
          </Link>
        </div>
      </HeroBlock>

      <SectionShell className="p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-emerald-100 bg-white p-4">
            <div>
              <h3 className="text-xl font-semibold text-emerald-950">Contas</h3>
              <p className="text-sm text-emerald-800">Selecione, se quiser, o usuario principal e o secundario.</p>
            </div>

            <label>
              <span className="field-label">Usuario principal</span>
              <select className="field-input mt-2" value={form.primaryUserId} onChange={(event) => updateForm("primaryUserId", event.currentTarget.value)}>
                <option value="">Nao unificar usuarios</option>
                {userOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {userLabel(user)} - {user.email}
                  </option>
                ))}
              </select>
            </label>

            {selectedPrimaryUser ? (
              <p className="text-xs text-emerald-700">
                {roleLabel(selectedPrimaryUser.role)} | {statusLabel(selectedPrimaryUser.status)} | Jogador:{" "}
                {selectedPrimaryUser.player ? playerLabel(selectedPrimaryUser.player) : "Nenhum"}
              </p>
            ) : null}

            <label>
              <span className="field-label">Usuario secundario</span>
              <select className="field-input mt-2" value={form.secondaryUserId} onChange={(event) => updateForm("secondaryUserId", event.currentTarget.value)}>
                <option value="">Nao unificar usuarios</option>
                {userOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {userLabel(user)} - {user.email}
                  </option>
                ))}
              </select>
            </label>

            {selectedSecondaryUser ? (
              <p className="text-xs text-emerald-700">
                {roleLabel(selectedSecondaryUser.role)} | {statusLabel(selectedSecondaryUser.status)} | Jogador:{" "}
                {selectedSecondaryUser.player ? playerLabel(selectedSecondaryUser.player) : "Nenhum"}
              </p>
            ) : null}
          </div>

          <div className="space-y-3 rounded-2xl border border-emerald-100 bg-white p-4">
            <div>
              <h3 className="text-xl font-semibold text-emerald-950">Jogadores</h3>
              <p className="text-sm text-emerald-800">Selecione, se quiser, o jogador principal e o secundario.</p>
            </div>

            <label>
              <span className="field-label">Jogador principal</span>
              <select className="field-input mt-2" value={form.primaryPlayerId} onChange={(event) => updateForm("primaryPlayerId", event.currentTarget.value)}>
                <option value="">Nao unificar jogadores</option>
                {playerOptions.map((player) => (
                  <option key={player.id} value={player.id}>
                    {playerLabel(player)}
                  </option>
                ))}
              </select>
            </label>

            {selectedPrimaryPlayer ? (
              <p className="text-xs text-emerald-700">
                Email: {selectedPrimaryPlayer.email ?? "Sem email"} | Usuario vinculado:{" "}
                {selectedPrimaryPlayer.user ? userLabel(selectedPrimaryPlayer.user) : "Nenhum"}
              </p>
            ) : null}

            <label>
              <span className="field-label">Jogador secundario</span>
              <select className="field-input mt-2" value={form.secondaryPlayerId} onChange={(event) => updateForm("secondaryPlayerId", event.currentTarget.value)}>
                <option value="">Nao unificar jogadores</option>
                {playerOptions.map((player) => (
                  <option key={player.id} value={player.id}>
                    {playerLabel(player)}
                  </option>
                ))}
              </select>
            </label>

            {selectedSecondaryPlayer ? (
              <p className="text-xs text-emerald-700">
                Email: {selectedSecondaryPlayer.email ?? "Sem email"} | Usuario vinculado:{" "}
                {selectedSecondaryPlayer.user ? userLabel(selectedSecondaryPlayer.user) : "Nenhum"}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="rounded-full" disabled={loading} type="button" onClick={requestPreview}>
            Carregar resumo
          </Button>
          <Link className={buttonVariants({ variant: "outline", className: "rounded-full" })} href="/admin/usuarios">
            Cancelar
          </Link>
        </div>
      </SectionShell>

      {preview ? (
        <SectionShell className="p-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold text-emerald-950">Resumo da unificacao</h3>
              <p className="text-sm text-emerald-800">
                Confira tudo com cuidado. A confirmacao final bloqueia o registro secundario e move os vinculos selecionados.
              </p>
            </div>

            {preview.userMerge ? (
              <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Contas</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-100 p-3">
                    <p className="font-semibold text-emerald-950">Principal</p>
                    <p className="text-sm text-emerald-900">{preview.userMerge.primary.label}</p>
                    <p className="text-xs text-emerald-700">{preview.userMerge.primary.email}</p>
                    <p className="text-xs text-emerald-700">
                      {roleLabel(preview.userMerge.primary.role)} | {statusLabel(preview.userMerge.primary.status)} | Jogador:{" "}
                      {preview.userMerge.primary.playerLabel ?? "Nenhum"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 p-3">
                    <p className="font-semibold text-emerald-950">Secundaria</p>
                    <p className="text-sm text-emerald-900">{preview.userMerge.secondary.label}</p>
                    <p className="text-xs text-emerald-700">{preview.userMerge.secondary.email}</p>
                    <p className="text-xs text-emerald-700">
                      {roleLabel(preview.userMerge.secondary.role)} | {statusLabel(preview.userMerge.secondary.status)} | Jogador:{" "}
                      {preview.userMerge.secondary.playerLabel ?? "Nenhum"}
                    </p>
                    <p className="mt-2 text-xs text-emerald-700">
                      Logins movidos: {preview.userMerge.secondary.loginMethods.length > 0 ? preview.userMerge.secondary.loginMethods.join(", ") : "Nenhum"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <p>
                    Resultado final: <strong>{roleLabel(preview.userMerge.result.role)}</strong> /{" "}
                    <strong>{statusLabel(preview.userMerge.result.status)}</strong>
                  </p>
                  <p>Email de login final: <strong>{preview.userMerge.result.finalEmail}</strong></p>
                  <p>{passwordActionLabel(preview.userMerge.result.passwordAction)}</p>
                </div>
              </div>
            ) : null}

            {preview.playerMerge ? (
              <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Historico esportivo</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-100 p-3">
                    <p className="font-semibold text-emerald-950">Principal</p>
                    <p className="text-sm text-emerald-900">{preview.playerMerge.primary.label}</p>
                    <p className="text-xs text-emerald-700">{preview.playerMerge.primary.email ?? "Sem email"}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 p-3">
                    <p className="font-semibold text-emerald-950">Secundario</p>
                    <p className="text-sm text-emerald-900">{preview.playerMerge.secondary.label}</p>
                    <p className="text-xs text-emerald-700">{preview.playerMerge.secondary.email ?? "Sem email"}</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-emerald-900 md:grid-cols-2 xl:grid-cols-5">
                  <p>Participacoes: <strong>{preview.playerMerge.summary.participants}</strong></p>
                  <p>Partidas em comum: <strong>{preview.playerMerge.summary.overlappingMatches}</strong></p>
                  <p>Ratings dados: <strong>{preview.playerMerge.summary.ratingsGiven}</strong></p>
                  <p>Ratings recebidos: <strong>{preview.playerMerge.summary.ratingsReceived}</strong></p>
                  <p>Logs/Mensagens: <strong>{preview.playerMerge.summary.whatsAppMessages}</strong></p>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">Avisos</p>
              <ul className="mt-2 space-y-2 text-sm text-amber-900">
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
              <label className="mt-4 flex items-start gap-3 text-sm font-medium text-amber-900">
                <input
                  checked={acknowledged}
                  className="mt-1 h-4 w-4 rounded border-amber-400 text-emerald-700 focus:ring-emerald-500"
                  type="checkbox"
                  onChange={(event) => setAcknowledged(event.currentTarget.checked)}
                />
                Estou ciente de que a unificacao e irreversivel e que o registro secundario sera ocultado e bloqueado.
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className="rounded-full" disabled={loading || !acknowledged} type="button" onClick={executeMerge}>
                Confirmar unificacao
              </Button>
              <Button className="rounded-full" disabled={loading} type="button" variant="outline" onClick={requestPreview}>
                Atualizar resumo
              </Button>
            </div>
          </div>
        </SectionShell>
      ) : null}

      {message ? <StatusNote tone={messageTone}>{message}</StatusNote> : null}
    </div>
  );
}
