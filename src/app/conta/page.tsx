"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HeroBlock, PageShell, SectionShell, StatusNote } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { resolveAuthenticatedLandingPath } from "@/lib/auth-redirect";

type EditablePosition = "GOLEIRO" | "ZAGUEIRO" | "MEIA" | "ATACANTE" | "OUTRO";
type AccountStatus = "PENDING_VERIFICATION" | "PENDING_APPROVAL" | "ACTIVE" | "DISABLED" | "REJECTED";

type AccountProfile = {
  id: string;
  name: string | null;
  email: string;
  nickname: string | null;
  position: EditablePosition | null;
  shirtNumberPreference: number | null;
  whatsApp: string | null;
  role: "ADMIN" | "PLAYER";
  status: AccountStatus;
  playerId: string | null;
  mustChangePassword: boolean;
  emailVerified: string | null;
};

type FormState = {
  name: string;
  nickname: string;
  position: EditablePosition | "";
  shirtNumberPreference: string;
  email: string;
  whatsApp: string;
};

const positionOptions: Array<{ value: EditablePosition; label: string }> = [
  { value: "GOLEIRO", label: "Goleiro" },
  { value: "ZAGUEIRO", label: "Zagueiro" },
  { value: "MEIA", label: "Meia" },
  { value: "ATACANTE", label: "Atacante" },
  { value: "OUTRO", label: "Outro" },
];

function toFormState(profile: AccountProfile): FormState {
  return {
    name: profile.name ?? "",
    nickname: profile.nickname ?? "",
    position: profile.position ?? "",
    shirtNumberPreference:
      profile.shirtNumberPreference === null ? "" : String(profile.shirtNumberPreference),
    email: profile.email,
    whatsApp: profile.whatsApp ?? "",
  };
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

function getStatusHeadline(profile: AccountProfile | null) {
  if (!profile) return "Carregando sua conta...";

  if (profile.mustChangePassword) {
    return "Sua conta precisa trocar a senha antes de continuar.";
  }

  if (profile.status === "PENDING_VERIFICATION") {
    return "Confirme seu email para liberar o acesso completo.";
  }

  if (profile.status === "PENDING_APPROVAL") {
    return "Sua conta esta sendo atualizada para o novo fluxo.";
  }

  if (profile.status === "REJECTED") {
    return "Seu cadastro foi rejeitado. Atualize os dados se necessario e fale com o administrador.";
  }

  if (profile.status === "DISABLED") {
    return "Seu acesso foi removido. Fale com o administrador para reativar a conta.";
  }

  if (!profile.playerId) {
    return "Sua conta esta pronta, mas o vinculo com o atleta ainda esta sendo finalizado.";
  }

  return "Conta pronta.";
}

export default function ContaPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [formState, setFormState] = useState<FormState>({
    name: "",
    nickname: "",
    position: "",
    shirtNumberPreference: "",
    email: "",
    whatsApp: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await fetch("/api/account/profile", {
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: "Nao foi possivel carregar sua conta." }));
          throw new Error(extractErrorMessage(payload, "Nao foi possivel carregar sua conta."));
        }

        const payload = (await response.json()) as AccountProfile;

        if (!active) {
          return;
        }

        const landingPath = resolveAuthenticatedLandingPath(payload);

        if (landingPath !== "/conta") {
          router.replace(landingPath);
          return;
        }

        setProfile(payload);
        setFormState(toFormState(payload));
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar sua conta.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  const isReadOnly = useMemo(
    () => Boolean(profile?.mustChangePassword || profile?.status === "DISABLED"),
    [profile],
  );

  function updateForm<K extends keyof FormState>(field: K, value: FormState[K]) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: formState.name,
          nickname: formState.nickname.trim() === "" ? null : formState.nickname.trim(),
          position: formState.position === "" ? null : formState.position,
          shirtNumberPreference:
            formState.shirtNumberPreference === "" ? null : Number(formState.shirtNumberPreference),
          email: formState.email.trim().toLowerCase(),
          whatsApp: formState.whatsApp.trim() === "" ? null : formState.whatsApp.trim(),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Nao foi possivel salvar sua conta." }));
        throw new Error(extractErrorMessage(payload, "Nao foi possivel salvar sua conta."));
      }

      const payload = (await response.json()) as AccountProfile & { verificationEmailSent?: boolean };
      setProfile(payload);
      setFormState(toFormState(payload));

      const landingPath = resolveAuthenticatedLandingPath(payload);

      if (landingPath !== "/conta") {
        router.replace(landingPath);
        return;
      }

      setMessage(
        payload.verificationEmailSent
          ? "Dados atualizados. Enviamos um novo email de confirmacao para continuar."
          : "Dados atualizados com sucesso.",
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel salvar sua conta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <HeroBlock className="p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Conta</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Finalize seu cadastro</h2>
        <p className="mt-1 text-sm text-emerald-800">
          Complete seus dados e acompanhe o status da sua conta enquanto finalizamos o acesso ao perfil.
        </p>
      </HeroBlock>

      {loading ? <StatusNote tone="warning">Carregando sua conta...</StatusNote> : null}
      {!loading && profile ? <StatusNote tone={profile.status === "REJECTED" || profile.status === "DISABLED" ? "error" : "warning"}>{getStatusHeadline(profile)}</StatusNote> : null}

      {!loading && profile ? (
        <SectionShell className="p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-emerald-950">Dados da conta</h3>
              <p className="text-sm text-emerald-800">
                Nome completo e email sao obrigatorios. O restante ajuda a deixar seu perfil completo.
              </p>
            </div>
            <div className="text-sm font-medium text-emerald-800">
              Status: <span className="font-semibold text-emerald-950">{profile.status}</span>
            </div>
          </div>

          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="md:col-span-2">
              <span className="field-label">Nome Completo</span>
              <input
                className="field-input"
                required
                disabled={isReadOnly}
                value={formState.name}
                onChange={(event) => updateForm("name", event.currentTarget.value)}
              />
            </label>

            <label>
              <span className="field-label">Email</span>
              <input
                className="field-input"
                type="email"
                required
                disabled={isReadOnly}
                value={formState.email}
                onChange={(event) => updateForm("email", event.currentTarget.value)}
              />
            </label>

            <label>
              <span className="field-label">Apelido</span>
              <input
                className="field-input"
                disabled={isReadOnly}
                value={formState.nickname}
                onChange={(event) => updateForm("nickname", event.currentTarget.value)}
              />
            </label>

            <label>
              <span className="field-label">Posicao</span>
              <select
                className="field-input"
                disabled={isReadOnly}
                value={formState.position}
                onChange={(event) => updateForm("position", event.currentTarget.value as FormState["position"])}
              >
                <option value="">Selecione...</option>
                {positionOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="field-label">Numero Preferido</span>
              <input
                className="field-input"
                type="number"
                min={0}
                max={99}
                disabled={isReadOnly}
                value={formState.shirtNumberPreference}
                onChange={(event) => updateForm("shirtNumberPreference", event.currentTarget.value)}
              />
            </label>

            <label className="md:col-span-2">
              <span className="field-label">Whatsapp</span>
              <input
                className="field-input"
                type="tel"
                disabled={isReadOnly}
                value={formState.whatsApp}
                onChange={(event) => updateForm("whatsApp", event.currentTarget.value)}
              />
            </label>

            <div className="md:col-span-2 flex flex-wrap gap-3">
              <Button className="rounded-full" type="submit" disabled={saving || isReadOnly}>
                {saving ? "Salvando..." : "Salvar dados"}
              </Button>
            </div>
          </form>
        </SectionShell>
      ) : null}

      {message ? <StatusNote tone="success">{message}</StatusNote> : null}
      {error ? <StatusNote tone="error">{error}</StatusNote> : null}
    </PageShell>
  );
}
