"use client";

import { FormEvent, useEffect, useState } from "react";
import { HeroBlock, SectionShell, StatusNote } from "@/components/layout/primitives";
import { formatDatePtBr } from "@/lib/date-format";

type SettingsResponse = {
  id: string;
  enabled: boolean;
  provider: "TWILIO";
  notifyOnConfirm: boolean;
  notifyOnCancel: boolean;
  confirmTemplate: string;
  cancelTemplate: string;
  updatedAt: string;
  envStatus: {
    configured: boolean;
    missingEnvVars: string[];
  };
  inboundMode: "OFF";
  webhookPath: string;
};

type Recipient = {
  id: string;
  label: string;
  phoneE164: string;
  isActive: boolean;
  lastTestAt: string | null;
};

type Notification = {
  id: string;
  eventType: "CONFIRM" | "CANCEL" | "TEST";
  direction: "OUTBOUND" | "INBOUND";
  status: "QUEUED" | "SENT" | "FAILED" | "SKIPPED";
  recipientPhone: string | null;
  body: string;
  errorMessage: string | null;
  providerMessageId: string | null;
  createdAt: string;
  player?: {
    id: string;
    name: string;
  } | null;
  match?: {
    id: string;
    matchDate: string;
    startTime: string;
    location: string | null;
  } | null;
  recipient?: {
    id: string;
    label: string;
    phoneE164: string;
  } | null;
};

type Notice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type RecipientDraft = {
  label: string;
  phone: string;
  isActive: boolean;
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR");
}

function notificationLabel(eventType: Notification["eventType"]) {
  if (eventType === "CANCEL") return "Desconfirmacao";
  if (eventType === "TEST") return "Teste";
  return "Confirmacao";
}

async function parseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = payload.error;
    if (typeof error === "string") {
      return error;
    }
  }

  return fallback;
}

export default function AdminWhatsappPage() {
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [notifyOnConfirm, setNotifyOnConfirm] = useState(true);
  const [notifyOnCancel, setNotifyOnCancel] = useState(true);
  const [confirmTemplate, setConfirmTemplate] = useState("");
  const [cancelTemplate, setCancelTemplate] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientDrafts, setRecipientDrafts] = useState<Record<string, RecipientDraft>>({});
  const [newLabel, setNewLabel] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newActive, setNewActive] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const [settingsResponse, recipientsResponse, notificationsResponse] = await Promise.all([
        fetch("/api/admin/whatsapp/settings"),
        fetch("/api/admin/whatsapp/recipients"),
        fetch("/api/admin/whatsapp/notifications?limit=40"),
      ]);

      if (!settingsResponse.ok || !recipientsResponse.ok || !notificationsResponse.ok) {
        throw new Error("Nao foi possivel carregar a configuracao de WhatsApp.");
      }

      const settingsPayload = (await settingsResponse.json()) as SettingsResponse;
      const recipientsPayload = (await recipientsResponse.json()) as Recipient[];
      const notificationsPayload = (await notificationsResponse.json()) as Notification[];

      setSettings(settingsPayload);
      setEnabled(settingsPayload.enabled);
      setNotifyOnConfirm(settingsPayload.notifyOnConfirm);
      setNotifyOnCancel(settingsPayload.notifyOnCancel);
      setConfirmTemplate(settingsPayload.confirmTemplate);
      setCancelTemplate(settingsPayload.cancelTemplate);
      setRecipients(recipientsPayload);
      setRecipientDrafts(
        Object.fromEntries(
          recipientsPayload.map((recipient) => [
            recipient.id,
            {
              label: recipient.label,
              phone: recipient.phoneE164,
              isActive: recipient.isActive,
            },
          ]),
        ),
      );
      setNotifications(notificationsPayload);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Falha ao carregar integracao.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch(() => {
      setNotice({ tone: "error", text: "Falha ao carregar integracao." });
    });
  }, []);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const response = await fetch("/api/admin/whatsapp/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enabled,
        notifyOnConfirm,
        notifyOnCancel,
        confirmTemplate,
        cancelTemplate,
      }),
    });

    if (!response.ok) {
      setNotice({
        tone: "error",
        text: await parseError(response, "Falha ao salvar configuracao."),
      });
      return;
    }

    const payload = (await response.json()) as SettingsResponse;
    setSettings(payload);
    setNotice({ tone: "success", text: "Configuracao de WhatsApp salva." });
  }

  async function createRecipient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const response = await fetch("/api/admin/whatsapp/recipients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: newLabel,
        phone: newPhone,
        isActive: newActive,
      }),
    });

    if (!response.ok) {
      setNotice({
        tone: "error",
        text: await parseError(response, "Falha ao criar destinatario."),
      });
      return;
    }

    setNewLabel("");
    setNewPhone("");
    setNewActive(true);
    setNotice({ tone: "success", text: "Destinatario adicionado." });
    await loadData();
  }

  async function saveRecipient(recipientId: string) {
    const draft = recipientDrafts[recipientId];
    if (!draft) return;

    const response = await fetch(`/api/admin/whatsapp/recipients/${recipientId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: draft.label,
        phone: draft.phone,
        isActive: draft.isActive,
      }),
    });

    if (!response.ok) {
      setNotice({
        tone: "error",
        text: await parseError(response, "Falha ao atualizar destinatario."),
      });
      return;
    }

    setNotice({ tone: "success", text: "Destinatario atualizado." });
    await loadData();
  }

  async function deleteRecipient(recipientId: string) {
    const response = await fetch(`/api/admin/whatsapp/recipients/${recipientId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setNotice({
        tone: "error",
        text: await parseError(response, "Falha ao remover destinatario."),
      });
      return;
    }

    setNotice({ tone: "success", text: "Destinatario removido." });
    await loadData();
  }

  async function sendTest(recipientId: string, eventType: "CONFIRM" | "CANCEL") {
    const response = await fetch("/api/admin/whatsapp/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipientId, eventType }),
    });

    if (!response.ok) {
      setNotice({
        tone: "error",
        text: await parseError(response, "Falha ao enviar teste."),
      });
      return;
    }

    setNotice({ tone: "success", text: "Mensagem de teste enviada." });
    await loadData();
  }

  async function retryNotification(notificationId: string) {
    const response = await fetch(`/api/admin/whatsapp/notifications/${notificationId}/retry`, {
      method: "POST",
    });

    if (!response.ok) {
      setNotice({
        tone: "error",
        text: await parseError(response, "Falha ao reenviar notificacao."),
      });
      return;
    }

    setNotice({ tone: "success", text: "Notificacao reenviada." });
    await loadData();
  }

  return (
    <div className="space-y-4">
      <HeroBlock className="p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Operacao interna</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Whatsapp</h2>
        <p className="text-sm text-emerald-800">
          Receba alertas administrativos 1:1 sempre que um jogador confirmar ou cancelar a presenca.
        </p>
      </HeroBlock>

      <SectionShell className="p-4">
        <h3 className="text-xl font-semibold text-emerald-950">Status da integracao</h3>
        {loading ? (
          <p className="mt-3 text-sm text-emerald-900">Carregando configuracao...</p>
        ) : settings ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="field-label">Provedor</p>
              <p className="font-semibold">{settings.provider}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="field-label">Ambiente</p>
              <p className="font-semibold">{settings.envStatus.configured ? "Configurado" : "Incompleto"}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="field-label">Duas vias</p>
              <p className="font-semibold">Preparado, desligado</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="field-label">Webhook futuro</p>
              <p className="font-semibold">{settings.webhookPath}</p>
            </div>
          </div>
        ) : null}

        {settings && settings.envStatus.missingEnvVars.length > 0 ? (
          <StatusNote className="mt-3" tone="warning">
            Variaveis ausentes: {settings.envStatus.missingEnvVars.join(", ")}
          </StatusNote>
        ) : null}
      </SectionShell>

      <SectionShell className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xl font-semibold text-emerald-950">Destinatarios</h3>
            <p className="text-sm text-emerald-800">Cada numero recebe a mesma mensagem individualmente.</p>
          </div>
        </div>

        <form className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1fr_auto_auto] md:items-end" onSubmit={createRecipient}>
          <label>
            <span className="field-label">Nome interno</span>
            <input className="field-input" value={newLabel} onChange={(event) => setNewLabel(event.currentTarget.value)} required />
          </label>
          <label>
            <span className="field-label">Telefone</span>
            <input
              className="field-input"
              type="tel"
              value={newPhone}
              placeholder="+5551999999999"
              onChange={(event) => setNewPhone(event.currentTarget.value)}
              required
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-emerald-900 md:pb-3">
            <input type="checkbox" checked={newActive} onChange={(event) => setNewActive(event.currentTarget.checked)} />
            Ativo
          </label>
          <button className="btn btn-primary" type="submit">Adicionar</button>
        </form>

        <ul className="mt-4 space-y-3">
          {recipients.length === 0 ? (
            <li className="rounded-xl border border-dashed border-emerald-200 p-4 text-sm text-emerald-900">
              Nenhum destinatario configurado.
            </li>
          ) : (
            recipients.map((recipient) => {
              const draft = recipientDrafts[recipient.id] ?? {
                label: recipient.label,
                phone: recipient.phoneE164,
                isActive: recipient.isActive,
              };

              return (
                <li key={recipient.id} className="rounded-xl border border-emerald-100 p-3">
                  <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto_auto_auto_auto] lg:items-end">
                    <label>
                      <span className="field-label">Nome interno</span>
                      <input
                        className="field-input"
                        value={draft.label}
                        onChange={(event) =>
                          setRecipientDrafts((current) => ({
                            ...current,
                            [recipient.id]: { ...draft, label: event.currentTarget.value },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span className="field-label">Telefone</span>
                      <input
                        className="field-input"
                        value={draft.phone}
                        onChange={(event) =>
                          setRecipientDrafts((current) => ({
                            ...current,
                            [recipient.id]: { ...draft, phone: event.currentTarget.value },
                          }))
                        }
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-emerald-900 lg:pb-3">
                      <input
                        type="checkbox"
                        checked={draft.isActive}
                        onChange={(event) =>
                          setRecipientDrafts((current) => ({
                            ...current,
                            [recipient.id]: { ...draft, isActive: event.currentTarget.checked },
                          }))
                        }
                      />
                      Ativo
                    </label>
                    <button className="btn btn-primary" type="button" onClick={() => saveRecipient(recipient.id)}>
                      Salvar
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => sendTest(recipient.id, "CONFIRM")}>
                      Testar
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => deleteRecipient(recipient.id)}>
                      Remover
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-emerald-800">
                    Ultimo teste: {formatDateTime(recipient.lastTestAt)}
                  </p>
                </li>
              );
            })
          )}
        </ul>
      </SectionShell>

      <form onSubmit={saveSettings}>
        <SectionShell className="p-4">
          <h3 className="text-xl font-semibold text-emerald-950">Eventos e templates</h3>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-emerald-100 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.currentTarget.checked)} />
                Integracao habilitada
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                <input
                  type="checkbox"
                  checked={notifyOnConfirm}
                  onChange={(event) => setNotifyOnConfirm(event.currentTarget.checked)}
                />
                Notificar confirmacao
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                <input
                  type="checkbox"
                  checked={notifyOnCancel}
                  onChange={(event) => setNotifyOnCancel(event.currentTarget.checked)}
                />
                Notificar desconfirmacao
              </label>
              <p className="text-xs text-emerald-800">
                Placeholders disponiveis: {"{{playerName}}"}, {"{{actionLabel}}"}, {"{{matchDate}}"}, {"{{startTime}}"}, {"{{location}}"}.
              </p>
            </div>

            <div className="grid gap-3">
              <label>
                <span className="field-label">Template de confirmacao</span>
                <textarea
                  className="field-input min-h-28"
                  value={confirmTemplate}
                  onChange={(event) => setConfirmTemplate(event.currentTarget.value)}
                />
              </label>
              <label>
                <span className="field-label">Template de desconfirmacao</span>
                <textarea
                  className="field-input min-h-28"
                  value={cancelTemplate}
                  onChange={(event) => setCancelTemplate(event.currentTarget.value)}
                />
              </label>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn btn-primary" type="submit">Salvar configuracao</button>
            <button className="btn btn-ghost" type="button" onClick={() => loadData()}>
              Recarregar
            </button>
          </div>
        </SectionShell>
      </form>

      <SectionShell className="p-4">
        <h3 className="text-xl font-semibold text-emerald-950">Historico</h3>
        <ul className="mt-4 space-y-3 text-sm">
          {notifications.length === 0 ? (
            <li className="rounded-xl border border-dashed border-emerald-200 p-4 text-emerald-900">
              Nenhuma notificacao registrada ainda.
            </li>
          ) : (
            notifications.map((notification) => (
              <li key={notification.id} className="rounded-xl border border-emerald-100 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-emerald-950">
                      {notificationLabel(notification.eventType)} - {notification.status}
                    </p>
                    <p className="text-xs text-emerald-800">
                      {formatDateTime(notification.createdAt)}
                      {notification.player ? ` | Jogador: ${notification.player.name}` : ""}
                      {notification.recipient ? ` | Destino: ${notification.recipient.label}` : ""}
                      {notification.recipientPhone ? ` | ${notification.recipientPhone}` : ""}
                    </p>
                    {notification.match ? (
                      <p className="text-xs text-emerald-800">
                        Partida: {formatDatePtBr(notification.match.matchDate)} as {notification.match.startTime}
                        {notification.match.location ? ` em ${notification.match.location}` : ""}
                      </p>
                    ) : null}
                  </div>
                  {notification.status === "FAILED" ? (
                    <button className="btn btn-ghost" type="button" onClick={() => retryNotification(notification.id)}>
                      Reenviar
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 text-emerald-950">{notification.body}</p>
                {notification.errorMessage ? (
                  <p className="mt-2 text-xs font-medium text-rose-700">{notification.errorMessage}</p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </SectionShell>

      {notice ? <StatusNote tone={notice.tone}>{notice.text}</StatusNote> : null}
    </div>
  );
}

