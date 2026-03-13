import { Position } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildWhatsAppRosterMessage } from "@/lib/whatsapp-service";
import { normalizePhoneToE164, sendTwilioWhatsAppMessage } from "@/lib/whatsapp";

const originalEnv = { ...process.env };

describe("whatsapp utils", () => {
  beforeEach(() => {
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "test-token";
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("normalizes brazil phone numbers to E.164", () => {
    expect(normalizePhoneToE164("(51) 99999-9999")).toBe("+5551999999999");
  });

  it("preserves international numbers already in E.164", () => {
    expect(normalizePhoneToE164("+14155552671")).toBe("+14155552671");
  });

  it("builds a roster message with filled and empty slots up to 16", () => {
    const rendered = buildWhatsAppRosterMessage({
      matchDate: "2026-03-12",
      startTime: "19:00",
      appBaseUrl: "https://pelada-de-quinta.vercel.app",
      siteName: "Lo Sports FC",
      confirmedPlayers: [
        { name: "Marcio", position: Position.GOLEIRO },
        { name: "Pedro", position: Position.ZAGUEIRO },
        { name: "Lucas", position: Position.MEIA },
        { name: "Bruno", position: Position.ATACANTE },
      ],
    });

    expect(rendered).toContain("LO SPORTS FC");
    expect(rendered).toContain("12/03/2026 - 19:00");
    expect(rendered).toContain("1 - Marcio (G)");
    expect(rendered).toContain("4 - Bruno (A)");
    expect(rendered).toContain("5 -");
    expect(rendered).toContain("16 -");
    expect(rendered).toContain("Confirme sua vaga aqui: https://pelada-de-quinta.vercel.app/");
  });

  it("expands the roster beyond 16 and keeps all position abbreviations", () => {
    const rendered = buildWhatsAppRosterMessage({
      matchDate: "2026-03-19",
      startTime: "20:30",
      appBaseUrl: "https://pelada-de-quinta.vercel.app/",
      confirmedPlayers: [
        { name: "P1", position: Position.GOLEIRO },
        { name: "P2", position: Position.ZAGUEIRO },
        { name: "P3", position: Position.MEIA },
        { name: "P4", position: Position.ATACANTE },
        { name: "P5", position: Position.OUTRO },
        { name: "P6", position: Position.MEIA },
        { name: "P7", position: Position.MEIA },
        { name: "P8", position: Position.MEIA },
        { name: "P9", position: Position.MEIA },
        { name: "P10", position: Position.MEIA },
        { name: "P11", position: Position.MEIA },
        { name: "P12", position: Position.MEIA },
        { name: "P13", position: Position.MEIA },
        { name: "P14", position: Position.MEIA },
        { name: "P15", position: Position.MEIA },
        { name: "P16", position: Position.MEIA },
        { name: "P17", position: Position.MEIA },
        { name: "P18", position: Position.MEIA },
      ],
    });

    expect(rendered).toContain("1 - P1 (G)");
    expect(rendered).toContain("2 - P2 (Z)");
    expect(rendered).toContain("3 - P3 (M)");
    expect(rendered).toContain("4 - P4 (A)");
    expect(rendered).toContain("5 - P5 (O)");
    expect(rendered).toContain("17 - P17 (M)");
    expect(rendered).toContain("18 - P18 (M)");
    expect(rendered).not.toContain("19 -");
  });

  it("maps Twilio 63007 to an actionable sandbox error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({
          code: 63007,
          message: "Twilio could not find a Channel with the specified From address",
        }),
      }),
    );

    const result = await sendTwilioWhatsAppMessage({
      toE164: "+5551999999999",
      body: "Teste",
    });

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("Twilio 63007");
    expect(result.errorMessage).toContain("TWILIO_WHATSAPP_FROM");
    expect(result.errorMessage).toContain("WhatsApp Sandbox");
  });
});
