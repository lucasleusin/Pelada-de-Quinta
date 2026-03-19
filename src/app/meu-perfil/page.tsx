"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatDatePtBr } from "@/lib/date-format";
import { HeroBlock, PageShell, SectionShell, StatusNote } from "@/components/layout/primitives";
import { PlayerFifaCard, type PlayerCardPosition } from "@/components/player-fifa-card";
import { Button } from "@/components/ui/button";

type EditablePosition = "GOLEIRO" | "ZAGUEIRO" | "MEIA" | "ATACANTE";
type UserRole = "ADMIN" | "PLAYER";

type CurrentUser = {
  id: string;
  role: UserRole;
  status: "PENDING_VERIFICATION" | "PENDING_APPROVAL" | "ACTIVE" | "DISABLED" | "REJECTED";
  playerId: string | null;
  mustChangePassword?: boolean;
};

type ProfileFormState = {
  name: string;
  nickname: string;
  position: EditablePosition;
  shirtNumberPreference: string;
  email: string;
  phone: string;
};

type PlayerHistoryPayload = {
  player: {
    id: string;
    name: string;
    nickname: string | null;
    position: PlayerCardPosition;
    shirtNumberPreference: number | null;
    photoUrl: string | null;
    photoPath: string | null;
    email: string | null;
    phone: string | null;
  };
  totals: {
    matches: number;
    goals: number;
    assists: number;
    goalsConceded: number;
    avgRating: number;
    wins: number;
    losses: number;
    draws: number;
    goalsPerMatch: number;
    efficiency: number;
    avgGoalsPerMatch: number;
    avgAssistsPerMatch: number;
    avgConcededPerMatch: number;
  };
  history: Array<{
    matchId: string;
    match: {
      id: string;
      matchDate: string;
      teamAScore: number | null;
      teamBScore: number | null;
    };
    goals: number;
    assists: number;
    goalsConceded: number;
    result: "WIN" | "DRAW" | "LOSS" | null;
    averageRating: number | null;
    ratingsCount: number;
  }>;
};

function toEditablePosition(position: PlayerCardPosition): EditablePosition {
  if (position === "GOLEIRO" || position === "ZAGUEIRO" || position === "MEIA" || position === "ATACANTE") {
    return position;
  }

  return "MEIA";
}

function getResultLabel(result: "WIN" | "DRAW" | "LOSS" | null) {
  if (result === "WIN") return "Vitoria";
  if (result === "DRAW") return "Empate";
  if (result === "LOSS") return "Derrota";
  return "Sem resultado";
}

function pendingMessage(status: CurrentUser["status"]) {
  if (status === "PENDING_VERIFICATION") return "Confirme seu email para liberar sua conta.";
  if (status === "PENDING_APPROVAL") return "Sua conta esta sendo atualizada para o novo fluxo.";
  if (status === "REJECTED") return "Seu cadastro foi rejeitado. Fale com o administrador.";
  if (status === "DISABLED") return "Seu acesso foi removido. Fale com o administrador.";
  return "Sua conta ainda nao esta pronta para uso.";
}

function resolveErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved: string = resolveErrorMessage(item, "");
      if (resolved) return resolved;
    }
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if ("formErrors" in record) {
      const resolved: string = resolveErrorMessage(record.formErrors, "");
      if (resolved) return resolved;
    }

    if ("fieldErrors" in record && record.fieldErrors && typeof record.fieldErrors === "object") {
      for (const nestedValue of Object.values(record.fieldErrors as Record<string, unknown>)) {
        const resolved: string = resolveErrorMessage(nestedValue, "");
        if (resolved) return resolved;
      }
    }

    if ("error" in record) {
      const resolved: string = resolveErrorMessage(record.error, "");
      if (resolved) return resolved;
    }
  }

  return fallback;
}

export default function MeuPerfilPage() {
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profileData, setProfileData] = useState<PlayerHistoryPayload | null>(null);
  const [formState, setFormState] = useState<ProfileFormState>({
    name: "",
    nickname: "",
    position: "MEIA",
    shirtNumberPreference: "",
    email: "",
    phone: "",
  });
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [photoStatus, setPhotoStatus] = useState("");
  const [message, setMessage] = useState("");

  const requestedPlayerId = searchParams.get("playerId");
  const requestedMode = searchParams.get("modo");
  const isAdminReadOnly =
    currentUser?.role === "ADMIN" &&
    currentUser.status === "ACTIVE" &&
    !currentUser.mustChangePassword &&
    requestedMode === "admin" &&
    Boolean(requestedPlayerId);
  const canEditProfile =
    currentUser?.status === "ACTIVE" &&
    currentUser.playerId !== null &&
    !currentUser.mustChangePassword &&
    !isAdminReadOnly;
  const canViewProfile =
    currentUser?.status === "ACTIVE" &&
    !currentUser.mustChangePassword &&
    (Boolean(currentUser.playerId) || Boolean(isAdminReadOnly));
  const canRenderProfile = useMemo(() => canViewProfile && profileData !== null, [canViewProfile, profileData]);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Nao foi possivel carregar a sessao atual.");
        }

        const payload = (await response.json()) as CurrentUser;
        setCurrentUser(payload);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Falha ao carregar a sessao."));
  }, []);

  useEffect(() => {
    if (!currentUser || !canViewProfile) return;

    const endpoint = isAdminReadOnly && requestedPlayerId ? `/api/players/${requestedPlayerId}/history` : "/api/players/me/history";

    fetch(endpoint, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: "Nao foi possivel carregar o perfil." }));
          throw new Error(resolveErrorMessage(payload.error, "Nao foi possivel carregar o perfil."));
        }

        const payload = (await response.json()) as PlayerHistoryPayload;
        setProfileData(payload);
        setFormState({
          name: payload.player.name,
          nickname: payload.player.nickname ?? "",
          position: toEditablePosition(payload.player.position),
          shirtNumberPreference:
            payload.player.shirtNumberPreference === null ? "" : String(payload.player.shirtNumberPreference),
          email: payload.player.email ?? "",
          phone: payload.player.phone ?? "",
        });
        setIsDirty(false);
        setSaveStatus("idle");
        setSaveMessage("");
        setPhotoStatus("");
      })
      .catch((error) => {
        const errorMessage = error instanceof Error ? error.message : "Nao foi possivel carregar o perfil.";
        setMessage(errorMessage);
      });
  }, [canViewProfile, currentUser, isAdminReadOnly, requestedPlayerId]);

  useEffect(() => {
    if (!canEditProfile || !profileData || !isDirty) return;

    const timeout = setTimeout(async () => {
      setSaveStatus("saving");
      setSaveMessage("");

      const response = await fetch("/api/players/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: formState.name,
          nickname: formState.nickname.trim() === "" ? null : formState.nickname.trim(),
          position: formState.position,
          shirtNumberPreference: formState.shirtNumberPreference ? Number(formState.shirtNumberPreference) : null,
          email: formState.email.trim() === "" ? null : formState.email.trim(),
          phone: formState.phone.trim() === "" ? null : formState.phone.trim(),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Falha ao salvar alteracoes." }));
        setSaveStatus("error");
        setSaveMessage(resolveErrorMessage(payload.error, "Falha ao salvar alteracoes."));
        return;
      }

      const updatedPlayer = (await response.json()) as PlayerHistoryPayload["player"];

      setProfileData((current) =>
        current
          ? {
              ...current,
              player: {
                ...current.player,
                ...updatedPlayer,
              },
            }
          : current,
      );
      setIsDirty(false);
      setSaveStatus("saved");
      setSaveMessage(`Alteracoes salvas automaticamente em ${new Date().toLocaleTimeString("pt-BR")}.`);
    }, 700);

    return () => clearTimeout(timeout);
  }, [canEditProfile, formState, isDirty, profileData]);

  function updateForm<K extends keyof ProfileFormState>(field: K, value: ProfileFormState[K]) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
    setIsDirty(true);
  }

  async function handlePhotoUpload(file: File | null) {
    if (!file || !canEditProfile) return;

    setPhotoStatus("Enviando foto...");
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/players/me/photo", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Falha ao enviar foto." }));
      setPhotoStatus(resolveErrorMessage(payload.error, "Falha ao enviar foto."));
      return;
    }

    const payload = (await response.json()) as { photoUrl: string | null; photoPath: string | null };
    setProfileData((current) =>
      current
        ? {
            ...current,
            player: {
              ...current.player,
              photoUrl: payload.photoUrl,
              photoPath: payload.photoPath,
            },
          }
        : current,
    );
    setPhotoStatus("Foto atualizada.");
  }

  async function removePhoto() {
    if (!canEditProfile) return;

    setPhotoStatus("Removendo foto...");
    const response = await fetch("/api/players/me/photo", {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Falha ao remover foto." }));
      setPhotoStatus(resolveErrorMessage(payload.error, "Falha ao remover foto."));
      return;
    }

    setProfileData((current) =>
      current
        ? {
            ...current,
            player: {
              ...current.player,
              photoUrl: null,
              photoPath: null,
            },
          }
        : current,
    );
    setPhotoStatus("Foto removida.");
  }

  return (
    <PageShell>
      <HeroBlock className="p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
          {isAdminReadOnly ? "Consulta administrativa" : "Cadastro"}
        </p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Perfil do Atleta</h2>
        <p className="mt-1 text-sm text-emerald-800">
          {isAdminReadOnly
            ? "Visualizacao somente leitura do atleta selecionado pelo admin."
            : "Edite seus dados e acompanhe o historico das suas partidas."}
        </p>
      </HeroBlock>

      {!currentUser ? <StatusNote tone="warning">Carregando sua conta...</StatusNote> : null}
      {currentUser && !canViewProfile && !isAdminReadOnly ? <StatusNote tone="warning">{pendingMessage(currentUser.status)}</StatusNote> : null}
      {isAdminReadOnly ? <StatusNote tone="neutral">Modo administrador: estatisticas e historico em somente leitura.</StatusNote> : null}

      {canRenderProfile && profileData ? (
        <>
          <section className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
            {!isAdminReadOnly ? (
              <SectionShell className="order-1 p-4 lg:order-2">
                <h3 className="text-xl font-semibold text-emerald-950">Edicao de dados</h3>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label>
                    <span className="field-label">Nome Completo</span>
                    <input className="field-input" value={formState.name} onChange={(event) => updateForm("name", event.currentTarget.value)} />
                  </label>

                  <label>
                    <span className="field-label">Apelido</span>
                    <input className="field-input" value={formState.nickname} onChange={(event) => updateForm("nickname", event.currentTarget.value)} />
                  </label>

                  <label>
                    <span className="field-label">Numero</span>
                    <input className="field-input" type="number" min={0} max={99} value={formState.shirtNumberPreference} onChange={(event) => updateForm("shirtNumberPreference", event.currentTarget.value)} />
                  </label>

                  <label>
                    <span className="field-label">Posicao</span>
                    <select className="field-input" value={formState.position} onChange={(event) => updateForm("position", event.currentTarget.value as EditablePosition)}>
                      <option value="GOLEIRO">Goleiro</option>
                      <option value="ZAGUEIRO">Zagueiro</option>
                      <option value="MEIA">Meio Campo</option>
                      <option value="ATACANTE">Atacante</option>
                    </select>
                  </label>

                  <label>
                    <span className="field-label">Email</span>
                    <input className="field-input" type="email" placeholder="email@exemplo.com" value={formState.email} onChange={(event) => updateForm("email", event.currentTarget.value)} />
                  </label>

                  <label>
                    <span className="field-label">Whatsapp</span>
                    <input className="field-input" type="tel" placeholder="(51) 99999-9999" value={formState.phone} onChange={(event) => updateForm("phone", event.currentTarget.value)} />
                  </label>
                </div>

                <div className="mt-4 rounded-lg bg-emerald-50 p-3">
                  <p className="text-sm font-medium text-emerald-900">Foto do jogador</p>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <label className="min-w-0 flex-1">
                      <span className="field-label">Arquivo</span>
                      <input className="field-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handlePhotoUpload(event.currentTarget.files?.[0] ?? null)} />
                    </label>
                    <Button className="rounded-full" variant="outline" type="button" onClick={removePhoto} disabled={!profileData.player.photoUrl}>
                      Remover foto
                    </Button>
                  </div>
                  {photoStatus ? <p className="mt-2 text-sm text-emerald-900">{photoStatus}</p> : null}
                </div>

                {saveStatus === "saving" ? <StatusNote className="mt-3" tone="warning">Salvando...</StatusNote> : null}
                {saveStatus === "saved" ? <StatusNote className="mt-3" tone="success">{saveMessage}</StatusNote> : null}
                {saveStatus === "error" ? <StatusNote className="mt-3" tone="error">{saveMessage}</StatusNote> : null}
              </SectionShell>
            ) : (
              <SectionShell className="order-1 p-4 lg:order-2">
                <h3 className="text-xl font-semibold text-emerald-950">Resumo do cadastro</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <p><span className="field-label">Nome Completo</span><br />{profileData.player.name}</p>
                  <p><span className="field-label">Apelido</span><br />{profileData.player.nickname ?? "-"}</p>
                  <p><span className="field-label">Numero</span><br />{profileData.player.shirtNumberPreference ?? "-"}</p>
                  <p><span className="field-label">Posicao</span><br />{profileData.player.position}</p>
                  <p><span className="field-label">Email</span><br />{profileData.player.email ?? "-"}</p>
                  <p><span className="field-label">Whatsapp</span><br />{profileData.player.phone ?? "-"}</p>
                </div>
              </SectionShell>
            )}

            <div className="order-2 lg:order-1">
              <PlayerFifaCard
                player={{
                  name: profileData.player.nickname ?? profileData.player.name,
                  position: profileData.player.position,
                  shirtNumberPreference: profileData.player.shirtNumberPreference,
                  photoUrl: profileData.player.photoUrl,
                }}
                totals={profileData.totals}
                showDownloadButton={!isAdminReadOnly}
              />
            </div>
          </section>

          <SectionShell className="p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-emerald-950">Partidas jogadas</h3>
                <p className="text-sm text-emerald-800">Historico detalhado do atleta com desempenho por partida.</p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">
                {profileData.history.length} partida{profileData.history.length === 1 ? "" : "s"}
              </p>
            </div>

            {profileData.history.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {profileData.history.map((item) => (
                  <li key={item.matchId} className="rounded-xl border border-emerald-100 bg-zinc-50 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-emerald-950">
                          {formatDatePtBr(item.match.matchDate)} - {item.match.teamAScore ?? "-"} x {item.match.teamBScore ?? "-"} ({getResultLabel(item.result)})
                        </p>
                        <p className="mt-1 text-sm text-emerald-800">
                          Gols: {item.goals} | Assistencias: {item.assists} | Gols sofridos: {item.goalsConceded}
                        </p>
                      </div>

                      <div className="shrink-0 text-left sm:text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Nota media</p>
                        <p className="text-sm font-semibold text-emerald-950">{item.averageRating === null ? "Sem Nota" : item.averageRating.toFixed(1)}</p>
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Votos</p>
                        <p className="text-sm font-semibold text-emerald-950">{item.ratingsCount}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-emerald-800">Nenhuma partida jogada registrada para este atleta.</p>
            )}
          </SectionShell>
        </>
      ) : null}

      {message ? <StatusNote tone="error">{message}</StatusNote> : null}
    </PageShell>
  );
}
