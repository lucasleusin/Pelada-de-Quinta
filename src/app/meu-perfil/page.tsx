"use client";

import { useEffect, useMemo, useState } from "react";
import { PlayerFifaCard, type PlayerCardPosition } from "@/components/player-fifa-card";

type ActivePlayer = {
  id: string;
  name: string;
};

type EditablePosition = "GOLEIRO" | "ZAGUEIRO" | "MEIA" | "ATACANTE";

type ProfileFormState = {
  name: string;
  position: EditablePosition;
  shirtNumberPreference: string;
  email: string;
  phone: string;
};

type PlayerHistoryPayload = {
  player: {
    id: string;
    name: string;
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
};

function toEditablePosition(position: PlayerCardPosition): EditablePosition {
  if (position === "GOLEIRO" || position === "ZAGUEIRO" || position === "MEIA" || position === "ATACANTE") {
    return position;
  }

  return "MEIA";
}

export default function MeuPerfilPage() {
  const [players, setPlayers] = useState<ActivePlayer[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [profileData, setProfileData] = useState<PlayerHistoryPayload | null>(null);
  const [formState, setFormState] = useState<ProfileFormState>({
    name: "",
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

  const canRenderProfile = useMemo(() => profileData !== null && selectedPlayerId !== "", [profileData, selectedPlayerId]);

  useEffect(() => {
    fetch("/api/players?active=true")
      .then((response) => response.json())
      .then((payload: ActivePlayer[]) => {
        setPlayers(payload);
      })
      .catch(() => setMessage("Falha ao carregar jogadores ativos."));
  }, []);

  function resetProfileState() {
    setProfileData(null);
    setFormState({
      name: "",
      position: "MEIA",
      shirtNumberPreference: "",
      email: "",
      phone: "",
    });
    setIsDirty(false);
    setSaveStatus("idle");
    setSaveMessage("");
    setPhotoStatus("");
  }

  function handleSelectPlayer(playerId: string) {
    setSelectedPlayerId(playerId);
    setMessage("");

    if (!playerId) {
      resetProfileState();
    }
  }

  useEffect(() => {
    if (!selectedPlayerId) return;

    fetch(`/api/players/${selectedPlayerId}/history`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Nao foi possivel carregar os dados deste jogador.");
        }

        const payload = (await response.json()) as PlayerHistoryPayload;
        setProfileData(payload);
        setFormState({
          name: payload.player.name,
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
        const errorMessage =
          error instanceof Error ? error.message : "Nao foi possivel carregar os dados deste jogador.";
        setMessage(errorMessage);
      });
  }, [selectedPlayerId]);

  useEffect(() => {
    if (!selectedPlayerId || !profileData || !isDirty) return;

    const timeout = setTimeout(async () => {
      setSaveStatus("saving");
      setSaveMessage("");

      const response = await fetch(`/api/players/${selectedPlayerId}/profile`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: formState.name,
          position: formState.position,
          shirtNumberPreference: formState.shirtNumberPreference ? Number(formState.shirtNumberPreference) : null,
          email: formState.email.trim() === "" ? null : formState.email.trim(),
          phone: formState.phone.trim() === "" ? null : formState.phone.trim(),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Falha ao salvar alteracoes." }));
        setSaveStatus("error");
        setSaveMessage(payload.error ?? "Falha ao salvar alteracoes.");
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
      setPlayers((current) =>
        current.map((player) => (player.id === updatedPlayer.id ? { ...player, name: updatedPlayer.name } : player)),
      );
      setIsDirty(false);
      setSaveStatus("saved");
      setSaveMessage(`Alteracoes salvas automaticamente em ${new Date().toLocaleTimeString("pt-BR")}.`);
    }, 700);

    return () => clearTimeout(timeout);
  }, [formState, isDirty, profileData, selectedPlayerId]);

  function updateForm<K extends keyof ProfileFormState>(field: K, value: ProfileFormState[K]) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
    setIsDirty(true);
  }

  async function handlePhotoUpload(file: File | null) {
    if (!file || !selectedPlayerId) return;

    setPhotoStatus("Enviando foto...");
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/players/${selectedPlayerId}/photo`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Falha ao enviar foto." }));
      setPhotoStatus(payload.error ?? "Falha ao enviar foto.");
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
    if (!selectedPlayerId) return;

    setPhotoStatus("Removendo foto...");
    const response = await fetch(`/api/players/${selectedPlayerId}/photo`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Falha ao remover foto." }));
      setPhotoStatus(payload.error ?? "Falha ao remover foto.");
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
    <div className="space-y-5">
      <section className="card p-5">
        <h2 className="text-3xl font-bold text-emerald-950">Meu Perfil</h2>
        <p className="mt-1 text-sm text-emerald-800">
          Selecione o jogador e atualize os dados. O salvamento e automatico.
        </p>

        <label className="field-label mt-4" htmlFor="profile-player-select">
          Jogador
        </label>
        <select
          id="profile-player-select"
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
      </section>

      {canRenderProfile && profileData ? (
        <section className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
          <div className="order-1 card p-4 lg:order-2">
            <h3 className="text-xl font-semibold text-emerald-950">Edicao de dados</h3>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label>
                <span className="field-label">Nome</span>
                <input
                  className="field-input"
                  value={formState.name}
                  onChange={(event) => updateForm("name", event.currentTarget.value)}
                />
              </label>

              <label>
                <span className="field-label">Numero</span>
                <input
                  className="field-input"
                  type="number"
                  min={0}
                  max={99}
                  value={formState.shirtNumberPreference}
                  onChange={(event) => updateForm("shirtNumberPreference", event.currentTarget.value)}
                />
              </label>

              <label>
                <span className="field-label">Posicao</span>
                <select
                  className="field-input"
                  value={formState.position}
                  onChange={(event) => updateForm("position", event.currentTarget.value as EditablePosition)}
                >
                  <option value="GOLEIRO">Goleiro</option>
                  <option value="ZAGUEIRO">Zagueiro</option>
                  <option value="MEIA">Meio Campo</option>
                  <option value="ATACANTE">Atacante</option>
                </select>
              </label>

              <label>
                <span className="field-label">Email</span>
                <input
                  className="field-input"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formState.email}
                  onChange={(event) => updateForm("email", event.currentTarget.value)}
                />
              </label>

              <label className="md:col-span-2">
                <span className="field-label">Telefone</span>
                <input
                  className="field-input"
                  type="tel"
                  placeholder="(51) 99999-9999"
                  value={formState.phone}
                  onChange={(event) => updateForm("phone", event.currentTarget.value)}
                />
              </label>
            </div>

            <div className="mt-4 rounded-lg bg-emerald-50 p-3">
              <p className="text-sm font-medium text-emerald-900">Foto do jogador</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="min-w-[240px] flex-1">
                  <span className="field-label">Arquivo</span>
                  <input
                    className="field-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => handlePhotoUpload(event.currentTarget.files?.[0] ?? null)}
                  />
                </label>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={removePhoto}
                  disabled={!profileData.player.photoUrl}
                >
                  Remover foto
                </button>
              </div>
              {photoStatus ? <p className="mt-2 text-sm text-emerald-900">{photoStatus}</p> : null}
            </div>

            {saveStatus === "saving" ? <p className="mt-3 text-sm text-amber-700">Salvando...</p> : null}
            {saveStatus === "saved" ? <p className="mt-3 text-sm text-emerald-800">{saveMessage}</p> : null}
            {saveStatus === "error" ? <p className="mt-3 text-sm text-red-700">{saveMessage}</p> : null}
          </div>

          <div className="order-2 lg:order-1">
            <PlayerFifaCard
              player={{
                name: profileData.player.name,
                position: profileData.player.position,
                shirtNumberPreference: profileData.player.shirtNumberPreference,
                photoUrl: profileData.player.photoUrl,
              }}
              totals={profileData.totals}
              showDownloadButton
            />
          </div>
        </section>
      ) : (
        <section className="card p-4">
          <p className="text-sm text-emerald-900">Selecione um jogador para editar o perfil.</p>
        </section>
      )}

      {message ? <p className="text-sm font-medium text-emerald-900">{message}</p> : null}
    </div>
  );
}
