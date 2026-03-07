import {
  PresenceStatus,
  Prisma,
  WhatsAppMessageEventType,
  WhatsAppMessageStatus,
} from "@prisma/client";
import { formatDatePtBr } from "@/lib/date-format";
import { getPrismaClient } from "@/lib/db";
import {
  getWhatsAppEnvStatus,
  normalizePhoneToE164,
  renderWhatsAppTemplate,
  sendTwilioWhatsAppMessage,
} from "@/lib/whatsapp";

const DEFAULT_SETTINGS_ID = "default";
const DEFAULT_CONFIRM_TEMPLATE =
  "{{playerName}} confirmou presenca para {{matchDate}} as {{startTime}} em {{location}}.";
const DEFAULT_CANCEL_TEMPLATE =
  "{{playerName}} cancelou presenca para {{matchDate}} as {{startTime}} em {{location}}.";

type DbClient = ReturnType<typeof getPrismaClient>;

type PresenceNotificationInput = {
  previousStatus: PresenceStatus | null;
  nextStatus: PresenceStatus;
  player: {
    id: string;
    name: string;
  };
  match: {
    id: string;
    matchDate: Date;
    startTime: string;
    location: string | null;
  };
};

type DispatchMessageInput = {
  eventType: WhatsAppMessageEventType;
  body: string;
  playerId?: string;
  matchId?: string;
  recipientId?: string;
  recipientPhone?: string;
};

function db() {
  return getPrismaClient();
}

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function getMissingEnvError() {
  const status = getWhatsAppEnvStatus();
  return status.configured ? null : `Configuracao ausente: ${status.missingEnvVars.join(", ")}`;
}

function resolveActionLabel(eventType: WhatsAppMessageEventType) {
  if (eventType === WhatsAppMessageEventType.CANCEL) {
    return "cancelou presenca";
  }

  if (eventType === WhatsAppMessageEventType.TEST) {
    return "executou um teste de envio";
  }

  return "confirmou presenca";
}

function buildTemplateContext(input: {
  playerName: string;
  actionLabel: string;
  matchDate: Date;
  startTime: string;
  location: string | null;
}) {
  return {
    playerName: input.playerName,
    actionLabel: input.actionLabel,
    matchDate: formatDatePtBr(input.matchDate),
    startTime: input.startTime,
    location: input.location?.trim() || "Local nao informado",
  };
}

async function ensureSettings(prisma: DbClient = db()) {
  return prisma.whatsAppSettings.upsert({
    where: { id: DEFAULT_SETTINGS_ID },
    update: {},
    create: {
      id: DEFAULT_SETTINGS_ID,
      confirmTemplate: DEFAULT_CONFIRM_TEMPLATE,
      cancelTemplate: DEFAULT_CANCEL_TEMPLATE,
    },
  });
}

async function createMessageLog(input: DispatchMessageInput & { status?: WhatsAppMessageStatus; errorMessage?: string; rawPayload?: Prisma.InputJsonValue | null }, prisma: DbClient = db()) {
  return prisma.whatsAppMessageLog.create({
    data: {
      direction: "OUTBOUND",
      eventType: input.eventType,
      provider: "TWILIO",
      recipientPhone: input.recipientPhone ?? null,
      body: input.body,
      status: input.status ?? WhatsAppMessageStatus.QUEUED,
      errorMessage: input.errorMessage ?? null,
      rawPayload: input.rawPayload ?? undefined,
      playerId: input.playerId ?? null,
      matchId: input.matchId ?? null,
      recipientId: input.recipientId ?? null,
    },
  });
}

async function dispatchMessage(input: DispatchMessageInput, prisma: DbClient = db()) {
  const log = await createMessageLog(input, prisma);

  if (!input.recipientPhone) {
    return prisma.whatsAppMessageLog.update({
      where: { id: log.id },
      data: {
        status: WhatsAppMessageStatus.SKIPPED,
        errorMessage: "Nenhum telefone de destinatario foi informado.",
      },
    });
  }

  const missingEnvError = getMissingEnvError();
  if (missingEnvError) {
    return prisma.whatsAppMessageLog.update({
      where: { id: log.id },
      data: {
        status: WhatsAppMessageStatus.FAILED,
        errorMessage: missingEnvError,
      },
    });
  }

  try {
    const result = await sendTwilioWhatsAppMessage({
      toE164: input.recipientPhone,
      body: input.body,
    });

    return prisma.whatsAppMessageLog.update({
      where: { id: log.id },
      data: {
        status: result.ok ? WhatsAppMessageStatus.SENT : WhatsAppMessageStatus.FAILED,
        providerMessageId: result.providerMessageId,
        errorMessage: result.errorMessage ?? null,
        rawPayload: result.rawPayload as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada ao enviar mensagem.";

    return prisma.whatsAppMessageLog.update({
      where: { id: log.id },
      data: {
        status: WhatsAppMessageStatus.FAILED,
        errorMessage: message,
      },
    });
  }
}

export async function getWhatsAppSettings(prisma: DbClient = db()) {
  const settings = await ensureSettings(prisma);
  const envStatus = getWhatsAppEnvStatus();

  return {
    ...settings,
    envStatus,
  };
}

export async function updateWhatsAppSettings(
  input: {
    enabled: boolean;
    notifyOnConfirm: boolean;
    notifyOnCancel: boolean;
    confirmTemplate: string;
    cancelTemplate: string;
  },
  prisma: DbClient = db(),
) {
  return prisma.whatsAppSettings.upsert({
    where: { id: DEFAULT_SETTINGS_ID },
    update: input,
    create: {
      id: DEFAULT_SETTINGS_ID,
      ...input,
    },
  });
}

export async function listWhatsAppRecipients(prisma: DbClient = db()) {
  await ensureSettings(prisma);

  return prisma.whatsAppRecipient.findMany({
    where: { settingsId: DEFAULT_SETTINGS_ID },
    orderBy: [{ isActive: "desc" }, { label: "asc" }],
  });
}

export async function createWhatsAppRecipient(
  input: { label: string; phone: string; isActive?: boolean },
  prisma: DbClient = db(),
) {
  await ensureSettings(prisma);
  const phoneE164 = normalizePhoneToE164(input.phone);

  if (!phoneE164) {
    throw new Error("Telefone invalido. Use um numero valido para WhatsApp.");
  }

  try {
    return await prisma.whatsAppRecipient.create({
      data: {
        settingsId: DEFAULT_SETTINGS_ID,
        label: input.label.trim(),
        phoneE164,
        isActive: input.isActive ?? true,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("Este numero ja esta cadastrado como destinatario.");
    }

    throw error;
  }
}

export async function updateWhatsAppRecipient(
  recipientId: string,
  input: { label?: string; phone?: string; isActive?: boolean },
  prisma: DbClient = db(),
) {
  const data: {
    label?: string;
    phoneE164?: string;
    isActive?: boolean;
  } = {};

  if (typeof input.label === "string") {
    data.label = input.label.trim();
  }

  if (typeof input.phone === "string") {
    const phoneE164 = normalizePhoneToE164(input.phone);
    if (!phoneE164) {
      throw new Error("Telefone invalido. Use um numero valido para WhatsApp.");
    }
    data.phoneE164 = phoneE164;
  }

  if (typeof input.isActive === "boolean") {
    data.isActive = input.isActive;
  }

  try {
    return await prisma.whatsAppRecipient.update({
      where: { id: recipientId },
      data,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("Este numero ja esta cadastrado como destinatario.");
    }

    throw error;
  }
}

export async function deleteWhatsAppRecipient(recipientId: string, prisma: DbClient = db()) {
  return prisma.whatsAppRecipient.delete({
    where: { id: recipientId },
  });
}

export async function listWhatsAppMessageLogs(limit = 30, prisma: DbClient = db()) {
  return prisma.whatsAppMessageLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      player: {
        select: { id: true, name: true },
      },
      match: {
        select: { id: true, matchDate: true, startTime: true, location: true },
      },
      recipient: {
        select: { id: true, label: true, phoneE164: true },
      },
    },
  });
}

export async function retryWhatsAppMessageLog(logId: string, prisma: DbClient = db()) {
  const log = await prisma.whatsAppMessageLog.findUnique({
    where: { id: logId },
    include: {
      recipient: true,
    },
  });

  if (!log) {
    throw new Error("Registro de mensagem nao encontrado.");
  }

  return dispatchMessage(
    {
      eventType: log.eventType,
      body: log.body,
      playerId: log.playerId ?? undefined,
      matchId: log.matchId ?? undefined,
      recipientId: log.recipientId ?? undefined,
      recipientPhone: log.recipientPhone ?? log.recipient?.phoneE164 ?? undefined,
    },
    prisma,
  );
}

export async function sendWhatsAppTest(recipientId: string, eventType: WhatsAppMessageEventType, prisma: DbClient = db()) {
  const settings = await ensureSettings(prisma);
  const recipient = await prisma.whatsAppRecipient.findUnique({ where: { id: recipientId } });

  if (!recipient) {
    throw new Error("Destinatario nao encontrado.");
  }

  const template = eventType === WhatsAppMessageEventType.CANCEL ? settings.cancelTemplate : settings.confirmTemplate;
  const body = renderWhatsAppTemplate(
    template,
    buildTemplateContext({
      playerName: "Teste do admin",
      actionLabel: resolveActionLabel(eventType),
      matchDate: new Date(),
      startTime: "19:00",
      location: "Arena dos Coqueiros",
    }),
  );

  const result = await dispatchMessage(
    {
      eventType: WhatsAppMessageEventType.TEST,
      body,
      recipientId: recipient.id,
      recipientPhone: recipient.phoneE164,
    },
    prisma,
  );

  await prisma.whatsAppRecipient.update({
    where: { id: recipient.id },
    data: { lastTestAt: new Date() },
  });

  return result;
}

async function createSkippedNotification(
  eventType: WhatsAppMessageEventType,
  body: string,
  reason: string,
  playerId: string,
  matchId: string,
  prisma: DbClient,
) {
  await createMessageLog(
    {
      eventType,
      body,
      playerId,
      matchId,
      status: WhatsAppMessageStatus.SKIPPED,
      errorMessage: reason,
    },
    prisma,
  );
}

export async function notifyPresenceChange(input: PresenceNotificationInput, prisma: DbClient = db()) {
  if (input.previousStatus === input.nextStatus) {
    return;
  }

  const eventType =
    input.nextStatus === PresenceStatus.CONFIRMED
      ? WhatsAppMessageEventType.CONFIRM
      : input.nextStatus === PresenceStatus.CANCELED
        ? WhatsAppMessageEventType.CANCEL
        : null;

  if (!eventType) {
    return;
  }

  const settings = await ensureSettings(prisma);

  if (!settings.enabled) {
    const template = eventType === WhatsAppMessageEventType.CANCEL ? settings.cancelTemplate : settings.confirmTemplate;
    const body = renderWhatsAppTemplate(
      template,
      buildTemplateContext({
        playerName: input.player.name,
        actionLabel: resolveActionLabel(eventType),
        matchDate: input.match.matchDate,
        startTime: input.match.startTime,
        location: input.match.location,
      }),
    );

    await createSkippedNotification(eventType, body, "Integracao WhatsApp desabilitada.", input.player.id, input.match.id, prisma);
    return;
  }

  if (eventType === WhatsAppMessageEventType.CONFIRM && !settings.notifyOnConfirm) {
    await createSkippedNotification(
      eventType,
      settings.confirmTemplate,
      "Notificacao de confirmacao desabilitada.",
      input.player.id,
      input.match.id,
      prisma,
    );
    return;
  }

  if (eventType === WhatsAppMessageEventType.CANCEL && !settings.notifyOnCancel) {
    await createSkippedNotification(
      eventType,
      settings.cancelTemplate,
      "Notificacao de desconfirmacao desabilitada.",
      input.player.id,
      input.match.id,
      prisma,
    );
    return;
  }

  const recipients = await prisma.whatsAppRecipient.findMany({
    where: {
      settingsId: settings.id,
      isActive: true,
    },
    orderBy: { label: "asc" },
  });

  const template = eventType === WhatsAppMessageEventType.CANCEL ? settings.cancelTemplate : settings.confirmTemplate;
  const body = renderWhatsAppTemplate(
    template,
    buildTemplateContext({
      playerName: input.player.name,
      actionLabel: resolveActionLabel(eventType),
      matchDate: input.match.matchDate,
      startTime: input.match.startTime,
      location: input.match.location,
    }),
  );

  if (recipients.length === 0) {
    await createSkippedNotification(eventType, body, "Nenhum destinatario ativo configurado.", input.player.id, input.match.id, prisma);
    return;
  }

  await Promise.allSettled(
    recipients.map((recipient) =>
      dispatchMessage(
        {
          eventType,
          body,
          playerId: input.player.id,
          matchId: input.match.id,
          recipientId: recipient.id,
          recipientPhone: recipient.phoneE164,
        },
        prisma,
      ),
    ),
  );
}

