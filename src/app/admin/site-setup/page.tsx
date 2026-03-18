"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSiteSettingsController } from "@/components/site-settings-provider";
import { HeroBlock, SectionShell, StatusNote } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { getSiteAssetAccept, type SiteAssetKind } from "@/lib/site-asset";
import type { SiteSettingsPublic } from "@/lib/site-settings-contract";

type Notice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type UserRole = "ADMIN" | "PLAYER";

type ManagedUser = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  playerId: string | null;
  player: {
    id: string;
    name: string;
    nickname: string | null;
  } | null;
};

type UsersPayload = {
  pendingUsers: ManagedUser[];
  activeUsers: ManagedUser[];
  removedUsers: ManagedUser[];
  players: Array<{
    id: string;
    name: string;
    nickname: string | null;
  }>;
};

type SiteSettingsFormState = {
  siteName: string;
  siteShortName: string;
  siteDescription: string;
  locationLabel: string;
  headerBadge: string;
};

const assetCards: Array<{
  kind: SiteAssetKind;
  routeSegment: string;
  label: string;
  description: string;
}> = [
  {
    kind: "logo",
    routeSegment: "logo",
    label: "Logo",
    description: "Exibido no cabecalho do site quando estiver configurado.",
  },
  {
    kind: "favicon",
    routeSegment: "favicon",
    label: "Favicon",
    description: "Usado no navegador e nos metadados principais do site.",
  },
  {
    kind: "shareImage",
    routeSegment: "share-image",
    label: "Imagem de compartilhamento",
    description: "Usada em Open Graph e Twitter quando o site for compartilhado.",
  },
];

async function parseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);

  const resolvedError = resolveErrorMessage(payload);
  if (resolvedError) return resolvedError;

  return fallback;
}

function resolveErrorMessage(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const message = resolveErrorMessage(item);
      if (message) return message;
    }

    return null;
  }

  if (value && typeof value === "object") {
    if ("error" in value) {
      return resolveErrorMessage(value.error);
    }

    if ("formErrors" in value) {
      const message = resolveErrorMessage(value.formErrors);
      if (message) return message;
    }

    if ("fieldErrors" in value && value.fieldErrors && typeof value.fieldErrors === "object") {
      for (const nestedValue of Object.values(value.fieldErrors)) {
        const message = resolveErrorMessage(nestedValue);
        if (message) return message;
      }
    }
  }

  return null;
}

function toFormState(settings: SiteSettingsPublic): SiteSettingsFormState {
  return {
    siteName: settings.siteName,
    siteShortName: settings.siteShortName,
    siteDescription: settings.siteDescription,
    locationLabel: settings.locationLabel,
    headerBadge: settings.headerBadge,
  };
}

function userLabel(user: ManagedUser) {
  return user.player?.nickname
    ? `${user.player.nickname} (${user.player.name})`
    : user.player?.name ?? user.name?.trim() ?? user.email;
}

export default function AdminSiteSetupPage() {
  const { settings, setSettings } = useSiteSettingsController();
  const [formState, setFormState] = useState<SiteSettingsFormState>(() => toFormState(settings));
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<Record<SiteAssetKind, File | null>>({
    logo: null,
    favicon: null,
    shareImage: null,
  });
  const [assetStatus, setAssetStatus] = useState<Record<SiteAssetKind, string>>({
    logo: "",
    favicon: "",
    shareImage: "",
  });
  const [activeUsers, setActiveUsers] = useState<ManagedUser[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [roleLoadingId, setRoleLoadingId] = useState<string | null>(null);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [selectedAdminCandidateId, setSelectedAdminCandidateId] = useState("");

  const adminUsers = useMemo(
    () =>
      [...activeUsers]
        .filter((user) => user.role === "ADMIN" && Boolean(user.playerId && user.player))
        .sort((left, right) => userLabel(left).localeCompare(userLabel(right))),
    [activeUsers],
  );

  const adminCandidates = useMemo(
    () =>
      [...activeUsers]
        .filter((user) => user.role !== "ADMIN" && Boolean(user.playerId && user.player))
        .sort((left, right) => userLabel(left).localeCompare(userLabel(right))),
    [activeUsers],
  );

  function applySettings(nextSettings: SiteSettingsPublic) {
    setSettings(nextSettings);
    setFormState(toFormState(nextSettings));
  }

  async function loadAdminUsers() {
    setAdminsLoading(true);

    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });

      if (!response.ok) {
        throw new Error(await parseError(response, "Falha ao carregar usuarios admin."));
      }

      const payload = (await response.json()) as UsersPayload;
      setActiveUsers(payload.activeUsers);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Falha ao carregar usuarios admin.",
      });
    } finally {
      setAdminsLoading(false);
    }
  }

  useEffect(() => {
    void loadAdminUsers();
  }, []);

  async function saveBranding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    const response = await fetch("/api/admin/site-setup/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...formState,
        siteShortName: formState.siteName,
      }),
    });

    setSaving(false);

    if (!response.ok) {
      setNotice({
        tone: "error",
        text: await parseError(response, "Falha ao salvar configuracao do site."),
      });
      return;
    }

    const payload = (await response.json()) as SiteSettingsPublic;
    applySettings(payload);
    setNotice({ tone: "success", text: "Configuracoes atualizadas." });
  }

  async function updateAdminRole(user: ManagedUser, nextRole: UserRole) {
    setRoleLoadingId(user.id);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });

      if (!response.ok) {
        throw new Error(await parseError(response, "Falha ao atualizar permissao de admin."));
      }

      await loadAdminUsers();
      setNotice({
        tone: "success",
        text: nextRole === "ADMIN" ? "Permissao de admin adicionada." : "Permissao de admin removida.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Falha ao atualizar permissao de admin.",
      });
    } finally {
      setRoleLoadingId(null);
    }
  }

  function openAddAdminModal() {
    if (adminCandidates.length === 0) {
      setNotice({
        tone: "error",
        text: "Nao ha usuarios elegiveis para adicionar como admin.",
      });
      return;
    }

    setSelectedAdminCandidateId(adminCandidates[0]?.id ?? "");
    setShowAddAdminModal(true);
  }

  async function uploadAsset(kind: SiteAssetKind, routeSegment: string) {
    const file = files[kind];

    if (!file) {
      setAssetStatus((current) => ({
        ...current,
        [kind]: "Selecione um arquivo antes de enviar.",
      }));
      return;
    }

    setAssetStatus((current) => ({
      ...current,
      [kind]: "Enviando arquivo...",
    }));

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/admin/site-setup/${routeSegment}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorMessage = await parseError(response, "Falha ao enviar asset.");
      setAssetStatus((current) => ({
        ...current,
        [kind]: errorMessage,
      }));
      return;
    }

    const payload = (await response.json()) as SiteSettingsPublic;
    applySettings(payload);
    setFiles((current) => ({ ...current, [kind]: null }));
    setAssetStatus((current) => ({ ...current, [kind]: "Arquivo atualizado." }));
    setNotice({ tone: "success", text: "Asset atualizado com sucesso." });
  }

  async function removeAsset(kind: SiteAssetKind, routeSegment: string) {
    setAssetStatus((current) => ({
      ...current,
      [kind]: "Removendo arquivo...",
    }));

    const response = await fetch(`/api/admin/site-setup/${routeSegment}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorMessage = await parseError(response, "Falha ao remover asset.");
      setAssetStatus((current) => ({
        ...current,
        [kind]: errorMessage,
      }));
      return;
    }

    const payload = (await response.json()) as SiteSettingsPublic;
    applySettings(payload);
    setFiles((current) => ({ ...current, [kind]: null }));
    setAssetStatus((current) => ({ ...current, [kind]: "Arquivo removido." }));
    setNotice({ tone: "success", text: "Asset removido com sucesso." });
  }

  return (
    <div className="space-y-4">
      <HeroBlock className="p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Configuracao do produto</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Configuracoes</h2>
        <p className="text-sm text-emerald-800">
          Atualize o branding principal do site e gerencie quem pode acessar a area administrativa.
        </p>
      </HeroBlock>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)]">
        <SectionShell className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-emerald-950">Branding</h3>
              <p className="text-sm text-emerald-800">Esses campos alimentam o cabecalho, os metadados e os cards dos jogadores.</p>
            </div>
          </div>

          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={saveBranding}>
            <label>
              <span className="field-label">Nome do site</span>
              <input
                className="field-input"
                value={formState.siteName}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setFormState((current) => ({ ...current, siteName: value }));
                }}
                required
              />
            </label>

            <label className="md:col-span-2">
              <span className="field-label">Descricao</span>
              <textarea
                className="field-input min-h-24"
                value={formState.siteDescription}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setFormState((current) => ({ ...current, siteDescription: value }));
                }}
              />
            </label>

            <label>
              <span className="field-label">Badge do topo</span>
              <input
                className="field-input"
                value={formState.headerBadge}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setFormState((current) => ({ ...current, headerBadge: value }));
                }}
                placeholder="Gestao Semanal"
              />
            </label>

            <div className="md:col-span-2">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar branding"}
              </button>
            </div>
          </form>
        </SectionShell>

        <SectionShell className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-emerald-950">Usuario Admin</h3>
              <p className="text-sm text-emerald-800">Gerencie somente os usuarios que ja possuem permissao administrativa.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-full"
                type="button"
                disabled={adminCandidates.length === 0}
                onClick={openAddAdminModal}
              >
                Adicionar
              </Button>
              <Button className="rounded-full" type="button" variant="outline" onClick={() => void loadAdminUsers()}>
                Atualizar
              </Button>
            </div>
          </div>

          {adminsLoading ? (
            <p className="mt-4 text-sm text-emerald-800">Carregando usuarios...</p>
          ) : adminUsers.length === 0 ? (
            <p className="mt-4 text-sm text-emerald-800">Nao ha usuarios admin cadastrados no momento.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {adminUsers.map((user) => (
                <li key={user.id} className="rounded-xl border border-emerald-100 bg-white p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-emerald-950">{userLabel(user)}</p>
                      <p className="text-sm text-emerald-800">{user.email}</p>
                      <p className="text-xs uppercase tracking-[0.12em] text-emerald-700">
                        Admin ativo
                      </p>
                    </div>
                    <Button
                      className="rounded-full"
                      type="button"
                      variant="outline"
                      disabled={roleLoadingId === user.id}
                      onClick={() => updateAdminRole(user, "PLAYER")}
                    >
                      Remover admin
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionShell>
      </section>

      {showAddAdminModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/40 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl border border-emerald-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-emerald-950">Adicionar admin</h3>
                <p className="text-sm text-emerald-800">
                  Escolha um usuario ativo vinculado a jogador para receber permissao administrativa.
                </p>
              </div>
              <Button
                className="rounded-full"
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddAdminModal(false);
                  setSelectedAdminCandidateId("");
                }}
              >
                Fechar
              </Button>
            </div>

            {adminCandidates.length === 0 ? (
              <p className="mt-4 text-sm text-emerald-800">Nao ha usuarios elegiveis para adicionar como admin.</p>
            ) : (
              <>
                <label className="mt-4 block">
                  <span className="field-label">Usuario</span>
                  <select
                    className="field-input mt-2"
                    value={selectedAdminCandidateId}
                    onChange={(event) => setSelectedAdminCandidateId(event.currentTarget.value)}
                  >
                    {adminCandidates.map((user) => (
                      <option key={user.id} value={user.id}>
                        {userLabel(user)} - {user.email}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button
                    className="rounded-full"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddAdminModal(false);
                      setSelectedAdminCandidateId("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="rounded-full"
                    type="button"
                    disabled={!selectedAdminCandidateId || roleLoadingId !== null}
                    onClick={async () => {
                      const selectedUser = adminCandidates.find((user) => user.id === selectedAdminCandidateId);
                      if (!selectedUser) return;
                      await updateAdminRole(selectedUser, "ADMIN");
                      setShowAddAdminModal(false);
                      setSelectedAdminCandidateId("");
                    }}
                  >
                    Confirmar
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <SectionShell className="p-4">
        <div>
          <h3 className="text-xl font-semibold text-emerald-950">Assets</h3>
          <p className="text-sm text-emerald-800">Troque os arquivos visuais do site sem precisar editar o codigo.</p>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          {assetCards.map((asset) => {
            const currentUrl =
              asset.kind === "logo"
                ? settings.logoUrl
                : asset.kind === "favicon"
                  ? settings.faviconUrl
                  : settings.shareImageUrl;

            return (
              <section key={asset.kind} className="rounded-xl border border-emerald-100 p-4">
                <h4 className="text-lg font-semibold text-emerald-950">{asset.label}</h4>
                <p className="mt-1 text-sm text-emerald-800">{asset.description}</p>

                <div className="mt-3 flex min-h-40 items-center justify-center rounded-xl border border-dashed border-emerald-200 bg-emerald-50 p-3">
                  {currentUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentUrl}
                      alt={asset.label}
                      className={
                        asset.kind === "shareImage"
                          ? "max-h-40 w-full rounded-lg object-contain"
                          : "max-h-20 max-w-full rounded-lg object-contain"
                      }
                    />
                  ) : (
                    <p className="text-sm text-emerald-800">Nenhum arquivo configurado.</p>
                  )}
                </div>

                <label className="mt-3 block">
                  <span className="field-label">Arquivo</span>
                  <input
                    className="field-input"
                    type="file"
                    accept={getSiteAssetAccept(asset.kind)}
                    onChange={(event) => {
                      const nextFile = event.currentTarget.files?.[0] ?? null;
                      setFiles((current) => ({
                        ...current,
                        [asset.kind]: nextFile,
                      }));
                    }}
                  />
                </label>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn btn-primary" type="button" onClick={() => uploadAsset(asset.kind, asset.routeSegment)}>
                    Enviar
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={!currentUrl}
                    onClick={() => removeAsset(asset.kind, asset.routeSegment)}
                  >
                    Remover
                  </button>
                </div>

                {assetStatus[asset.kind] ? (
                  <p className="mt-2 text-xs font-medium text-emerald-900">{assetStatus[asset.kind]}</p>
                ) : null}
              </section>
            );
          })}
        </div>
      </SectionShell>

      {notice ? <StatusNote tone={notice.tone}>{notice.text}</StatusNote> : null}
    </div>
  );
}
