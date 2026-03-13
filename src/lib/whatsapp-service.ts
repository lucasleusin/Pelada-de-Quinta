import {
  MatchStatus,
  Position,
  PresenceStatus,
  Prisma,
  WhatsAppMessageEventType,
  WhatsAppMessageStatus,
} from "@prisma/client";
import { formatDatePtBr } from "@/lib/date-format";
import { getPrismaClient } from "@/lib/db";
import { DEFAULT_SITE_SETTINGS_VALUES } from "@/lib/site-settings-contract";
import { getSiteSettingsRecord } from "@/lib/site-settings";
import {
  getWhatsAppEnvStatus,
  normalizePhoneToE164,
  sendTwilioWhatsAppMessage,
} from "@/lib/whatsapp";

const DEFAULT_SETTINGS_ID = "default";
const DEFAULT_LEGACY_TEMPLATE = "Mensagem padrao de snapshot da pelada.";
const DEFAULT_APP_BASE_URL = "https://pelada.losportsconsulting.com";
const MIN_VISIBLE_SLOTS = 16;
const TEST_PREVIEW_START_TIME = "19:00";

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

type RosterPlayer = {
  name: string;
  position: Position;
};

type RosterParticipant = {
  confirmedAt: Date | null;
  createdAt: Date;
  player: {
    name: string;
    position: Position;
  };
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

function normalizeAppBaseUrl(appBaseUrl?: string) {
  const baseUrl =
    appBaseUrl?.trim() || process.env.APP_BASE_URL?.trim() || DEFAULT_APP_BASE_URL;

  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function getPositionCode(position: Position) {
  if (position === Position.GOLEIRO) return "G";
  if (position === Position.ZAGUEIRO) return "Z";
  if (position === Position.MEIA) return "M";
  if (position === Position.ATACANTE) return "A";
  return "O";
}

function compareRosterParticipants(left: RosterParticipant, right: RosterParticipant) {
  const leftConfirmedAt = left.confirmedAt?.getTime() ?? left.createdAt.getTime();
  const rightConfirmedAt = right.confirmedAt?.getTime() ?? right.createdAt.getTime();

  if (leftConfirmedAt !== rightConfirmedAt) {
    return leftConfirmedAt - rightConfirmedAt;
  }

  const leftCreatedAt = left.createdAt.getTime();
  const rightCreatedAt = right.createdAt.getTime();

  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  return left.player.name.localeCompare(right.player.name);
}

function resolvePresenceEventType(
  previousStatus: PresenceStatus | null,
  nextStatus: PresenceStatus,
) {
  if (nextStatus === PresenceStatus.CONFIRMED && previousStatus !== PresenceStatus.CONFIRMED) {
    return WhatsAppMessageEventType.CONFIRM;
  }

  if (previousStatus === PresenceStatus.CONFIRMED && nextStatus !== PresenceStatus.CONFIRMED) {
    return WhatsAppMessageEventType.CANCEL;
  }

  return null;
}

export function buildWhatsAppRosterMessage(input: {
  matchDate: Date | string;
  startTime: string;
  confirmedPlayers: RosterPlayer[];
  appBaseUrl?: string;
  siteName?: string;
}) {
  const visibleSlots = Math.max(MIN_VISIBLE_SLOTS, input.confirmedPlayers.length);
  const slotLines = Array.from({ length: visibleSlots }, (_, index) => {
    const player = input.confirmedPlayers[index];
    return player ? `${index + 1} - ${player.name} (${getPositionCode(player.position)})` : `${index + 1} -`;
  });

  return [
    (input.siteName?.trim() || DEFAULT_SITE_SETTINGS_VALUES.siteName).toUpperCase(),
    `${formatDatePtBr(input.matchDate)} - ${input.startTime}`,
    "",
    ...slotLines,
    "",
    `Confirme sua vaga aqui: ${normalizeAppBaseUrl(input.appBaseUrl)}`,
  ].join("\n");
}

async function ensureSettings(prisma: DbClient = db()) {
  return prisma.whatsAppSettings.upsert({
    where: { id: DEFAULT_SETTINGS_ID },
    update: {},
    create: {
      id: DEFAULT_SETTINGS_ID,
      confirmTemplate: DEFAULT_LEGACY_TEMPLATE,
      cancelTemplate: DEFAULT_LEGACY_TEMPLATE,
    },
  });
}

async function createMessageLog(
  input: DispatchMessageInput & {
    status?: WhatsAppMessageStatus;
    errorMessage?: string;
    rawPayload?: Prisma.InputJsonValue | null;
  },
  prisma: DbClient = db(),
) {
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

async function getMatchRosterSnapshot(matchId: string, prisma: DbClient = db()) {
  return prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      matchDate: true,
      startTime: true,
      participants: {
        where: {
          presenceStatus: PresenceStatus.CONFIRMED,
        },
        select: {
          confirmedAt: true,
          createdAt: true,
          player: {
            select: {
              name: true,
              position: true,
            },
          },
        },
      },
    },
  });
}

async function buildRosterBodyForMatch(matchId: string, prisma: DbClient = db()) {
  const match = await getMatchRosterSnapshot(matchId, prisma);

  if (!match) {
    throw new Error("Partida nao encontrada para gerar a mensagem de WhatsApp.");
  }

  const siteSettings = await getSiteSettingsRecord(prisma);

  const confirmedPlayers = [...match.participants]
    .sort(compareRosterParticipants)
    .map((participant) => ({
      name: participant.player.name,
      position: participant.player.position,
    }));

  return buildWhatsAppRosterMessage({
    matchDate: match.matchDate,
    startTime: match.startTime,
    confirmedPlayers,
    siteName: siteSettings.siteName,
  });
}

async function buildTestRosterBody(prisma: DbClient = db()) {
  const siteSettings = await getSiteSettingsRecord(prisma);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextMatch = await prisma.match.findFirst({
    where: {
      status: { not: MatchStatus.ARCHIVED },
      matchDate: { gte: today },
    },
    orderBy: { matchDate: "asc" },
    select: { id: true },
  });

  if (nextMatch) {
    return buildRosterBodyForMatch(nextMatch.id, prisma);
  }

  return buildWhatsAppRosterMessage({
    matchDate: new Date(),
    startTime: TEST_PREVIEW_START_TIME,
    confirmedPlayers: [],
    siteName: siteSettings.siteName,
  });
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

export async function getWhatsAppSettings(prisma: DbClient = db()) {
  const settings = await ensureSettings(prisma);
  const envStatus = getWhatsAppEnvStatus();

  return {
    id: settings.id,
    enabled: settings.enabled,
    provider: settings.provider,
    updatedAt: settings.updatedAt,
    envStatus,
  };
}

export async function updateWhatsAppSettings(
  input: {
    enabled: boolean;
  },
  prisma: DbClient = db(),
) {
  await ensureSettings(prisma);

  return prisma.whatsAppSettings.update({
    where: { id: DEFAULT_SETTINGS_ID },
    data: {
      enabled: input.enabled,
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

export async function sendWhatsAppTest(recipientId: string, prisma: DbClient = db()) {
  const recipient = await prisma.whatsAppRecipient.findUnique({ where: { id: recipientId } });

  if (!recipient) {
    throw new Error("Destinatario nao encontrado.");
  }

  const body = await buildTestRosterBody(prisma);
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

export async function notifyPresenceChange(input: PresenceNotificationInput, prisma: DbClient = db()) {
  if (input.previousStatus === input.nextStatus) {
    return;
  }

  const eventType = resolvePresenceEventType(input.previousStatus, input.nextStatus);

  if (!eventType) {
    return;
  }

  const settings = await ensureSettings(prisma);
  const body = await buildRosterBodyForMatch(input.match.id, prisma);

  if (!settings.enabled) {
    await createSkippedNotification(
      eventType,
      body,
      "Integracao WhatsApp desabilitada.",
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

  if (recipients.length === 0) {
    await createSkippedNotification(
      eventType,
      body,
      "Nenhum destinatario ativo configurado.",
      input.player.id,
      input.match.id,
      prisma,
    );
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
