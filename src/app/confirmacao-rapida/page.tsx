"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActionBar,
  HeroBlock,
  PageShell,
  SectionShell,
  StatusNote,
} from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { formatDatePtBr } from "@/lib/date-format";
import { cn } from "@/lib/utils";

const PLAYER_STORAGE_KEY = "pelada:selectedPlayerId";

type PresenceStatus = "CONFIRMED" | "WAITLIST" | "CANCELED";
type UiStatus = PresenceStatus | "PENDING";

type ActivePlayer = {
  id: string;
  name: string;
};

type MatchParticipant = {
  playerId: string;
  presenceStatus: PresenceStatus;
  player: {
    id: string;
    name: string;
  };
};

type NextMatch = {
  id: string;
  matchDate: string;
  startTime: string;
  location: string | null;
  participants: MatchParticipant[];
};

type NextMatchPayload = {
  match: NextMatch | null;
};

function statusLabel(status: UiStatus) {
  if (status === "CONFIRMED") return "Confirmado";
  if (status === "WAITLIST") return "Lista de espera";
  if (status === "CANCELED") return "Não vou";
  return "Pendente";
}

function statusClass(status: UiStatus) {
  if (status === "CONFIRMED") return "border-emerald-300 bg-emerald-100 text-emerald-800";
  if (status === "WAITLIST") return "border-amber-300 bg-amber-100 text-amber-800";
  if (status === "CANCELED") return "border-red-300 bg-red-100 text-red-800";
  return "border-zinc-300 bg-zinc-100 text-zinc-700";
}

export default function ConfirmacaoRapidaPage() {
  const [players, setPlayers] = useState<ActivePlayer[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [showPlayerSelector, setShowPlayerSelector] = useState(false);
  const [nextMatch, setNextMatch] = useState<NextMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"confirm" | "cancel" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const selectedPlayer = useMemo(
    () => players.find((player) => player.id === selectedPlayerId) ?? null,
    [players, selectedPlayerId],
  );

  const selectedParticipant = useMemo(
    () => nextMatch?.participants.find((participant) => participant.playerId === selectedPlayerId) ?? null,
    [nextMatch, selectedPlayerId],
  );

  const currentStatus: UiStatus = selectedPlayerId
    ? (selectedParticipant?.presenceStatus ?? "PENDING")
    : "PENDING";

  async function loadPlayersAndNextMatch() {
    setLoading(true);
    setErrorMessage("");

    try {
      const [playersRes, nextMatchRes] = await Promise.all([
        fetch("/api/players?active=true", { cache: "no-store" }),
        fetch("/api/matches/next", { cache: "no-store" }),
      ]);

      if (!playersRes.ok) {
        throw new Error("Falha ao carregar atletas ativos.");
      }

      if (!nextMatchRes.ok) {
        throw new Error("Falha ao carregar a próxima partida.");
      }

      const playersPayload = ((await playersRes.json()) as ActivePlayer[]).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      const nextMatchPayload = (await nextMatchRes.json()) as NextMatchPayload;

      setPlayers(playersPayload);
      setNextMatch(nextMatchPayload.match ?? null);

      const storedPlayerId =
        typeof window !== "undefined" ? window.localStorage.getItem(PLAYER_STORAGE_KEY) ?? "" : "";

      if (storedPlayerId && playersPayload.some((player) => player.id === storedPlayerId)) {
        setSelectedPlayerId(storedPlayerId);
        setShowPlayerSelector(false);
      } else {
        if (storedPlayerId && typeof window !== "undefined") {
          window.localStorage.removeItem(PLAYER_STORAGE_KEY);
        }
        setSelectedPlayerId("");
        setShowPlayerSelector(true);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao carregar confirmação rápida.");
    } finally {
      setLoading(false);
    }
  }

  async function reloadNextMatchOnly() {
    const response = await fetch("/api/matches/next", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Falha ao atualizar status da partida.");
    }

    const payload = (await response.json()) as NextMatchPayload;
    setNextMatch(payload.match ?? null);
  }

  useEffect(() => {
    loadPlayersAndNextMatch().catch(() => setErrorMessage("Erro ao carregar confirmação rápida."));
  }, []);

  useEffect(() => {
    if (!selectedPlayerId) return;

    if (!players.some((player) => player.id === selectedPlayerId)) {
      setSelectedPlayerId("");
      setShowPlayerSelector(true);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(PLAYER_STORAGE_KEY);
      }
    }
  }, [players, selectedPlayerId]);

  function handleSelectPlayer(nextPlayerId: string) {
    setSelectedPlayerId(nextPlayerId);
    setActionMessage("");
    setErrorMessage("");

    if (typeof window !== "undefined") {
      if (nextPlayerId) {
        window.localStorage.setItem(PLAYER_STORAGE_KEY, nextPlayerId);
      } else {
        window.localStorage.removeItem(PLAYER_STORAGE_KEY);
      }
    }

    setShowPlayerSelector(nextPlayerId === "");
  }

  async function handlePresenceAction(action: "confirm" | "cancel") {
    if (!nextMatch) {
      setErrorMessage("Não há partida em aberto para confirmar.");
      return;
    }

    if (!selectedPlayerId) {
      setErrorMessage("Selecione um atleta para confirmar presença.");
      setShowPlayerSelector(true);
      return;
    }

    setActionLoading(action);
    setErrorMessage("");
    setActionMessage("");

    const endpoint = action === "confirm" ? "confirm" : "cancel";

    try {
      const response = await fetch(`/api/matches/${nextMatch.id}/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId: selectedPlayerId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Falha ao atualizar presença." }));
        throw new Error(payload.error ?? "Falha ao atualizar presença.");
      }

      const payload = (await response.json()) as { presenceStatus?: PresenceStatus };

      if (action === "confirm") {
        if (payload.presenceStatus === "WAITLIST") {
          setActionMessage("Você entrou na lista de espera desta partida.");
        } else {
          setActionMessage("Presença confirmada com sucesso.");
        }
      } else {
        setActionMessage("Você foi marcado como não vou.");
      }

      await reloadNextMatchOnly();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao atualizar presença.");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <PageShell>
      <HeroBlock className="p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Atleta</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Confirmação rápida</h2>
        <p className="text-sm text-emerald-800">Confirme sua presença para a próxima partida em poucos toques.</p>

        {selectedPlayer ? (
          <ActionBar className="mt-4 flex items-center justify-between gap-2 p-3">
            <p className="text-sm text-emerald-900">
              Atleta selecionado: <strong>{selectedPlayer.name}</strong>
            </p>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setShowPlayerSelector((current) => !current)}
              aria-label="Trocar atleta selecionado"
            >
              Trocar atleta
            </Button>
          </ActionBar>
        ) : null}
      </HeroBlock>

      <SectionShell className="space-y-4 p-4 sm:p-5">
        {loading ? <p className="text-sm text-emerald-900">Carregando confirmação rápida...</p> : null}

        {!loading && showPlayerSelector ? (
          <div>
            <label className="field-label" htmlFor="quick-confirm-player-select">
              Selecione o atleta
            </label>
            <select
              id="quick-confirm-player-select"
              className="field-input max-w-md"
              value={selectedPlayerId}
              onChange={(event) => handleSelectPlayer(event.currentTarget.value)}
            >
              <option value="">Selecione...</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {!loading && !nextMatch ? (
          <p className="empty-state text-sm">Nenhuma partida em aberto no momento.</p>
        ) : null}

        {!loading && nextMatch ? (
          <div className="card space-y-4 p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Próxima partida
              </p>
              <p className="mt-1 text-xl font-semibold text-emerald-950">
                {formatDatePtBr(nextMatch.matchDate)} - {nextMatch.startTime}
              </p>
              <p className="text-sm text-emerald-800">
                {nextMatch.location ? nextMatch.location : "Local a definir"}
              </p>
            </div>

            {selectedPlayerId ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-emerald-900">Seu status:</span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em]",
                      statusClass(currentStatus),
                    )}
                  >
                    {statusLabel(currentStatus)}
                  </span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    className="h-11 rounded-full"
                    onClick={() => handlePresenceAction("confirm")}
                    disabled={actionLoading !== null}
                    aria-label="Confirmar presença na próxima partida"
                  >
                    {actionLoading === "confirm" ? "Confirmando..." : "Confirmar presença"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-full border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                    onClick={() => handlePresenceAction("cancel")}
                    disabled={actionLoading !== null}
                    aria-label="Informar que não vai na próxima partida"
                  >
                    {actionLoading === "cancel" ? "Atualizando..." : "Não vou"}
                  </Button>
                </div>
              </>
            ) : (
              <StatusNote tone="warning">Selecione um atleta para confirmar presença.</StatusNote>
            )}
          </div>
        ) : null}

        {actionMessage ? <StatusNote tone="success">{actionMessage}</StatusNote> : null}
        {errorMessage ? <StatusNote tone="error">{errorMessage}</StatusNote> : null}
      </SectionShell>
    </PageShell>
  );
}
