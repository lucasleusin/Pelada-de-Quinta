import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_COUNTRY_CODE = "55";
const TWILIO_REQUIRED_ENV_VARS = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM"] as const;

type TemplateValue = string | number | null | undefined;

export type WhatsAppTemplateContext = Record<string, TemplateValue>;

export type WhatsAppEnvStatus = {
  provider: "TWILIO";
  configured: boolean;
  missingEnvVars: string[];
};

export type WhatsAppSendInput = {
  toE164: string;
  body: string;
};

export type WhatsAppSendResult = {
  ok: boolean;
  providerMessageId: string | null;
  rawPayload: unknown;
  errorMessage?: string;
};

function digitsOnly(value: string) {
  return value.replace(/\D+/g, "");
}

export function normalizePhoneToE164(value: string, defaultCountryCode = DEFAULT_COUNTRY_CODE) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const digits = digitsOnly(trimmed);
    return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null;
  }

  if (trimmed.startsWith("00")) {
    const digits = digitsOnly(trimmed.slice(2));
    return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null;
  }

  const digits = digitsOnly(trimmed);

  if (digits.length === 10 || digits.length === 11) {
    return `+${defaultCountryCode}${digits}`;
  }

  if (digits.length >= 12 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

export function toWhatsAppAddress(phoneE164: string) {
  return `whatsapp:${phoneE164}`;
}

export function renderWhatsAppTemplate(template: string, context: WhatsAppTemplateContext) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/gu, (_, key: string) => {
    const value = context[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

export function getWhatsAppEnvStatus(): WhatsAppEnvStatus {
  const missingEnvVars = TWILIO_REQUIRED_ENV_VARS.filter((name) => {
    const value = process.env[name];
    return !value || value.trim().length === 0;
  });

  return {
    provider: "TWILIO",
    configured: missingEnvVars.length === 0,
    missingEnvVars: [...missingEnvVars],
  };
}

function getTwilioConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID?.trim() ?? "",
    authToken: process.env.TWILIO_AUTH_TOKEN?.trim() ?? "",
    from: process.env.TWILIO_WHATSAPP_FROM?.trim() ?? "",
  };
}

function getTwilioErrorMessage(payload: unknown, from: string) {
  const fallbackMessage =
    typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : "Falha ao enviar mensagem via Twilio.";

  const code =
    typeof payload === "object" && payload !== null && "code" in payload && typeof payload.code === "number"
      ? payload.code
      : null;

  if (code === 63007) {
    return [
      `Twilio 63007: o canal WhatsApp configurado em TWILIO_WHATSAPP_FROM (${from}) nao foi encontrado para esta conta.`,
      "Verifique se o WhatsApp Sandbox esta ativado na mesma conta/subconta do TWILIO_ACCOUNT_SID,",
      "se o TWILIO_AUTH_TOKEN pertence a essa mesma conta,",
      "e se TWILIO_WHATSAPP_FROM corresponde exatamente ao remetente exibido no console da Twilio.",
    ].join(" ");
  }

  return fallbackMessage;
}

export async function sendTwilioWhatsAppMessage(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
  const envStatus = getWhatsAppEnvStatus();
  if (!envStatus.configured) {
    return {
      ok: false,
      providerMessageId: null,
      rawPayload: { missingEnvVars: envStatus.missingEnvVars },
      errorMessage: `Configuracao ausente: ${envStatus.missingEnvVars.join(", ")}`,
    };
  }

  const { accountSid, authToken, from } = getTwilioConfig();
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: new URLSearchParams({
      To: toWhatsAppAddress(input.toE164),
      From: from,
      Body: input.body,
    }),
  });

  const payload = await response.json().catch(async () => ({ raw: await response.text().catch(() => "") }));

  if (!response.ok) {
    return {
      ok: false,
      providerMessageId: null,
      rawPayload: payload,
      errorMessage: getTwilioErrorMessage(payload, from),
    };
  }

  const providerMessageId =
    typeof payload === "object" && payload !== null && "sid" in payload && typeof payload.sid === "string"
      ? payload.sid
      : null;

  return {
    ok: true,
    providerMessageId,
    rawPayload: payload,
  };
}

function buildTwilioSignature(url: string, params: URLSearchParams, authToken: string) {
  const sorted = [...params.entries()].sort(([left], [right]) => left.localeCompare(right));
  const payload = `${url}${sorted.map(([key, value]) => `${key}${value}`).join("")}`;
  return createHmac("sha1", authToken).update(payload).digest("base64");
}

export async function validateTwilioWebhookRequest(request: Request) {
  const signature = request.headers.get("x-twilio-signature");
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();

  if (!signature || !authToken) {
    return false;
  }

  const formData = await request.clone().formData().catch(() => null);
  if (!formData) {
    return false;
  }

  const params = new URLSearchParams();
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      params.append(key, value);
    }
  }

  const expected = buildTwilioSignature(request.url, params, authToken);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(signatureBuffer, expectedBuffer);
}
