"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HeroBlock, SectionShell, StatusNote } from "@/components/layout/primitives";
import { Button, buttonVariants } from "@/components/ui/button";

type UserRole = "ADMIN" | "PLAYER";
type UserStatus = "PENDING_VERIFICATION" | "PENDING_APPROVAL" | "ACTIVE" | "DISABLED" | "REJECTED";

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
  players: MergeCandidatePlayer[];
};

type MergePreview = {
  playerMerge: {
    primary: {
      id: string;
      label: string;
      email: string | null;
      linkedUserEmail: string | null;
    };
    secondary: {
      id: string;
      label: string;
      email: string | null;
      linkedUserEmail: string | null;
    };
    summary: {
      primary: {
        matches: number;
        goals: number;
        assists: number;
        goalsConceded: number;
        averageRating: number;
      };
      secondary: {
        matches: number;
        goals: number;
        assists: number;
        goalsConceded: number;
        averageRating: number;
      };
    };
    accountOutcome:
      | "keep-primary-account"
      | "move-secondary-account-to-primary-player"
      | "no-account";
  };
  warnings: string[];
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

function playerLabel(player: { name: string; nickname: string | null }) {
  return player.nickname ? `${player.nickname} (${player.name})` : player.name;
}

function accountOutcomeSummary(outcome: MergePreview["playerMerge"]["accountOutcome"]) {
  if (outcome === "keep-primary-account") {
    return "A conta do jogador principal sera mantida ativa e a conta do secundario sera arquivada.";
  }

  if (outcome === "move-secondary-account-to-primary-player") {
    return "A conta vinculada do jogador secundario sera transferida para o jogador principal.";
  }

  return "Nenhum dos jogadores possui conta vinculada. A unificacao sera apenas esportiva.";
}

function formatAverageRating(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function StatsComparisonCard({
  title,
  tone,
  stats,
}: {
  title: string;
  tone: "primary" | "secondary";
  stats: MergePreview["playerMerge"]["summary"]["primary"];
}) {
  const cardClass =
    tone === "primary"
      ? "border-emerald-100 bg-white"
      : "border-amber-200 bg-amber-50/70";
  const labelClass = tone === "primary" ? "text-emerald-700" : "text-amber-800";
  const valueClass = tone === "primary" ? "text-emerald-950" : "text-amber-950";

  return (
    <div className={`rounded-2xl border p-4 ${cardClass}`}>
      <p className={`text-sm font-semibold ${valueClass}`}>{title}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div>
          <p className={`text-xs uppercase tracking-[0.12em] ${labelClass}`}>Jogos</p>
          <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{stats.matches}</p>
        </div>
        <div>
          <p className={`text-xs uppercase tracking-[0.12em] ${labelClass}`}>Gols</p>
          <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{stats.goals}</p>
        </div>
        <div>
          <p className={`text-xs uppercase tracking-[0.12em] ${labelClass}`}>Assistencias</p>
          <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{stats.assists}</p>
        </div>
        <div>
          <p className={`text-xs uppercase tracking-[0.12em] ${labelClass}`}>Gols sofridos</p>
          <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{stats.goalsConceded}</p>
        </div>
        <div>
          <p className={`text-xs uppercase tracking-[0.12em] ${labelClass}`}>Media de nota</p>
          <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{formatAverageRating(stats.averageRating)}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminJogadoresUnificarPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<MergeCandidatesPayload>({ players: [] });
  const [primaryPlayerId, setPrimaryPlayerId] = useState("");
  const [secondaryPlayerId, setSecondaryPlayerId] = useState("");
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

  const playerOptions = useMemo(
    () => [...candidates.players].sort((left, right) => playerLabel(left).localeCompare(playerLabel(right))),
    [candidates.players],
  );

  const selectedPrimaryPlayer = playerOptions.find((player) => player.id === primaryPlayerId) ?? null;
  const selectedSecondaryPlayer = playerOptions.find((player) => player.id === secondaryPlayerId) ?? null;

  function resetPreview() {
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
          primaryPlayerId,
          secondaryPlayerId,
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
          primaryPlayerId,
          secondaryPlayerId,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Nao foi possivel concluir a unificacao." }));
        throw new Error(extractErrorMessage(payload, "Nao foi possivel concluir a unificacao."));
      }

      await loadCandidates();
      setPrimaryPlayerId("");
      setSecondaryPlayerId("");
      setPreview(null);
      setAcknowledged(false);
      setMessage("Unificacao concluida com sucesso.");
      setMessageTone("success");
      window.dispatchEvent(new Event("auth-state-changed"));
      router.refresh();
      window.location.assign("/admin/jogadores");
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Cadastro esportivo</p>
            <h2 className="mt-1 text-3xl font-bold text-emerald-950">Unificar Jogadores</h2>
            <p className="text-sm text-emerald-800">
              Consolide historicos duplicados em um jogador principal e revise qual conta permanecera ativa ao final.
            </p>
          </div>
          <Link className={buttonVariants({ variant: "outline", className: "rounded-full" })} href="/admin/jogadores">
            Voltar para Jogadores
          </Link>
        </div>
      </HeroBlock>

      <SectionShell className="p-4">
        <div className="space-y-3 rounded-2xl border border-emerald-100 bg-white p-4">
          <div>
            <h3 className="text-xl font-semibold text-emerald-950">Selecao dos jogadores</h3>
            <p className="text-sm text-emerald-800">Escolha o registro principal e o historico secundario que sera absorvido.</p>
          </div>

          <label>
            <span className="field-label">Jogador principal</span>
            <select
              className="field-input mt-2"
              value={primaryPlayerId}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setPrimaryPlayerId(value);
                resetPreview();
              }}
            >
              <option value="">Selecione...</option>
              {playerOptions.map((player) => (
                <option key={player.id} value={player.id}>
                  {playerLabel(player)}
                </option>
              ))}
            </select>
          </label>

          {selectedPrimaryPlayer ? (
            <p className="text-xs text-emerald-700">
              Email do jogador: {selectedPrimaryPlayer.email ?? "Sem email"} | Conta vinculada: {selectedPrimaryPlayer.user?.email ?? "Nenhuma"}
            </p>
          ) : null}

          <label>
            <span className="field-label">Jogador secundario</span>
            <select
              className="field-input mt-2"
              value={secondaryPlayerId}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setSecondaryPlayerId(value);
                resetPreview();
              }}
            >
              <option value="">Selecione...</option>
              {playerOptions.map((player) => (
                <option key={player.id} value={player.id}>
                  {playerLabel(player)}
                </option>
              ))}
            </select>
          </label>

          {selectedSecondaryPlayer ? (
            <p className="text-xs text-emerald-700">
              Email do jogador: {selectedSecondaryPlayer.email ?? "Sem email"} | Conta vinculada: {selectedSecondaryPlayer.user?.email ?? "Nenhuma"}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="rounded-full" disabled={loading} type="button" onClick={requestPreview}>
            Carregar resumo
          </Button>
          <Link className={buttonVariants({ variant: "outline", className: "rounded-full" })} href="/admin/jogadores">
            Cancelar
          </Link>
        </div>
      </SectionShell>

      {preview ? (
        <SectionShell className="p-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold text-emerald-950">Resumo da unificacao</h3>
              <p className="text-sm text-emerald-800">O jogador principal sobrevivera. O secundario sera ocultado para uso normal.</p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-950">Destino da conta</p>
              <p className="mt-1 text-sm text-emerald-900">{accountOutcomeSummary(preview.playerMerge.accountOutcome)}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                <p className="text-sm font-semibold text-emerald-950">Jogador principal</p>
                <p className="mt-2 text-sm text-emerald-900">{preview.playerMerge.primary.label}</p>
                <p className="text-xs text-emerald-700">Email do jogador: {preview.playerMerge.primary.email ?? "Sem email"}</p>
                <p className="text-xs text-emerald-700">Conta vinculada: {preview.playerMerge.primary.linkedUserEmail ?? "Nenhuma"}</p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Jogador secundario</p>
                <p className="mt-2 text-sm text-amber-950">{preview.playerMerge.secondary.label}</p>
                <p className="text-xs text-amber-800">Email do jogador: {preview.playerMerge.secondary.email ?? "Sem email"}</p>
                <p className="text-xs text-amber-800">Conta vinculada: {preview.playerMerge.secondary.linkedUserEmail ?? "Nenhuma"}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-emerald-950">Comparacao esportiva</p>
                <p className="text-sm text-emerald-800">
                  Confira os numeros historicos de cada registro antes de unificar.
                </p>
              </div>

              <StatsComparisonCard title="Usuario principal" tone="primary" stats={preview.playerMerge.summary.primary} />
              <StatsComparisonCard title="Usuario secundario" tone="secondary" stats={preview.playerMerge.summary.secondary} />
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-900">Atenção</p>
              <ul className="mt-2 space-y-1 text-sm text-red-900">
                {preview.warnings.map((warning) => (
                  <li key={warning}>- {warning}</li>
                ))}
              </ul>

              <label className="mt-3 flex items-start gap-2 text-sm text-red-900">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.currentTarget.checked)}
                />
                <span>Entendo que a unificacao e definitiva e que o jogador secundario sera removido do uso normal.</span>
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className="rounded-full bg-red-600 text-white hover:bg-red-700" disabled={loading || !preview} type="button" onClick={executeMerge}>
                Confirmar unificacao
              </Button>
              <Button className="rounded-full" disabled={loading} type="button" variant="outline" onClick={requestPreview}>
                Recarregar resumo
              </Button>
            </div>
          </div>
        </SectionShell>
      ) : null}

      {message ? <StatusNote tone={messageTone}>{message}</StatusNote> : null}
    </div>
  );
}

