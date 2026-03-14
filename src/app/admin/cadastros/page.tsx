"use client";

import { useEffect, useMemo, useState } from "react";
import { HeroBlock, SectionShell, StatusNote } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";

type PendingUser = {
  id: string;
  name: string | null;
  email: string;
  nickname: string | null;
  position: "GOLEIRO" | "ZAGUEIRO" | "MEIA" | "ATACANTE" | "OUTRO" | null;
  shirtNumberPreference: number | null;
  whatsApp: string | null;
  status: "PENDING_VERIFICATION" | "PENDING_APPROVAL" | "ACTIVE" | "REJECTED";
  createdAt: string;
};

type Player = {
  id: string;
  name: string;
  nickname: string | null;
};

function playerLabel(player: Player) {
  return player.nickname ? `${player.nickname} (${player.name})` : player.name;
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

    const fieldErrors = record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>).fieldErrors
      : null;

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

  return fallback;
}

export default function AdminCadastrosPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function loadData() {
    const [usersRes, playersRes] = await Promise.all([
      fetch("/api/admin/users/pending", { cache: "no-store" }),
      fetch("/api/players?active=true", { cache: "no-store" }),
    ]);

    if (!usersRes.ok || !playersRes.ok) {
      throw new Error("Falha ao carregar cadastros pendentes.");
    }

    const [usersPayload, playersPayload] = (await Promise.all([usersRes.json(), playersRes.json()])) as [PendingUser[], Player[]];
    setUsers(usersPayload);
    setPlayers(playersPayload);
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadData();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Falha ao carregar cadastros.");
      }
    })();
  }, []);

  const sortedPlayers = useMemo(
    () => [...players].sort((left, right) => playerLabel(left).localeCompare(playerLabel(right))),
    [players],
  );

  async function sendApproval(userId: string, action: "link" | "create" | "reject") {
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
        const payload = await response.json().catch(() => ({ error: "Nao foi possivel atualizar o cadastro." }));
        setMessage(extractErrorMessage(payload, "Nao foi possivel atualizar o cadastro."));
        return;
      }

      setMessage("Cadastro atualizado.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel atualizar o cadastro.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <HeroBlock className="p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Aprovacao</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Cadastros pendentes</h2>
        <p className="text-sm text-emerald-800">Aprove, vincule a um jogador existente ou crie um novo cadastro de atleta.</p>
      </HeroBlock>

      <SectionShell className="p-4">
        {users.length === 0 ? (
          <p className="text-sm text-emerald-800">Nao ha cadastros pendentes.</p>
        ) : (
          <ul className="space-y-3">
            {users.map((user) => (
              <li key={user.id} className="rounded-xl border border-emerald-100 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1 text-sm text-emerald-900">
                    <p className="text-lg font-semibold text-emerald-950">{user.name ?? user.email}</p>
                    <p>Email: {user.email}</p>
                    {user.nickname ? <p>Apelido: {user.nickname}</p> : null}
                    {user.position ? <p>Posicao: {user.position}</p> : null}
                    {user.shirtNumberPreference !== null ? <p>Numero: {user.shirtNumberPreference}</p> : null}
                    {user.whatsApp ? <p>Whatsapp: {user.whatsApp}</p> : null}
                    <p>Status: {user.status}</p>
                  </div>

                  <div className="flex w-full max-w-xl flex-col gap-3">
                    <label>
                      <span className="field-label">Vincular a jogador existente</span>
                      <select
                        className="field-input"
                        value={selectedPlayers[user.id] ?? ""}
                        onChange={(event) =>
                          setSelectedPlayers((current) => ({
                            ...current,
                            [user.id]: event.currentTarget.value,
                          }))
                        }
                      >
                        <option value="">Selecione...</option>
                        {sortedPlayers.map((player) => (
                          <option key={player.id} value={player.id}>
                            {playerLabel(player)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <Button className="rounded-full" type="button" disabled={loadingId === user.id} onClick={() => sendApproval(user.id, "link")}>
                        Vincular existente
                      </Button>
                      <Button className="rounded-full" variant="outline" type="button" disabled={loadingId === user.id} onClick={() => sendApproval(user.id, "create")}>
                        Criar novo jogador
                      </Button>
                      <Button className="rounded-full border-red-300 bg-red-50 text-red-700 hover:bg-red-100" variant="outline" type="button" disabled={loadingId === user.id} onClick={() => sendApproval(user.id, "reject")}>
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionShell>

      {message ? <StatusNote tone="neutral">{message}</StatusNote> : null}
    </div>
  );
}
