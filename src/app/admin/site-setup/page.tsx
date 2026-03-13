"use client";

import { useState, type FormEvent } from "react";
import { useSiteSettingsController } from "@/components/site-settings-provider";
import { HeroBlock, SectionShell, StatusNote } from "@/components/layout/primitives";
import { getSiteAssetAccept, type SiteAssetKind } from "@/lib/site-asset";
import type { SiteSettingsPublic } from "@/lib/site-settings-contract";

type Notice = {
  tone: "neutral" | "success" | "error";
  text: string;
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

  function applySettings(nextSettings: SiteSettingsPublic) {
    setSettings(nextSettings);
    setFormState(toFormState(nextSettings));
  }

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
    setNotice({ tone: "success", text: "Configuracao do site atualizada." });
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
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Site Setup</h2>
        <p className="text-sm text-emerald-800">
          Atualize o branding principal do site, incluindo logo, favicon e imagem de compartilhamento.
        </p>
      </HeroBlock>

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
