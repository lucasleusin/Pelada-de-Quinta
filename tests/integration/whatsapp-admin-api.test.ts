import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminApi: vi.fn(),
  getWhatsAppSettings: vi.fn(),
  updateWhatsAppSettings: vi.fn(),
  listWhatsAppRecipients: vi.fn(),
  createWhatsAppRecipient: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  requireAdminApi: mocks.requireAdminApi,
}));

vi.mock("@/lib/whatsapp-service", () => ({
  getWhatsAppSettings: mocks.getWhatsAppSettings,
  updateWhatsAppSettings: mocks.updateWhatsAppSettings,
  listWhatsAppRecipients: mocks.listWhatsAppRecipients,
  createWhatsAppRecipient: mocks.createWhatsAppRecipient,
}));

import { GET as getSettings, PUT as putSettings } from "@/app/api/admin/whatsapp/settings/route";
import { GET as getRecipients, POST as postRecipients } from "@/app/api/admin/whatsapp/recipients/route";

function makeSettings() {
  return {
    id: "default",
    enabled: true,
    provider: "TWILIO",
    notifyOnConfirm: true,
    notifyOnCancel: false,
    confirmTemplate: "confirm",
    cancelTemplate: "cancel",
    createdAt: new Date(),
    updatedAt: new Date(),
    envStatus: {
      configured: true,
      missingEnvVars: [],
    },
  };
}

describe("admin whatsapp api", () => {
  beforeEach(() => {
    mocks.requireAdminApi.mockReset();
    mocks.getWhatsAppSettings.mockReset();
    mocks.updateWhatsAppSettings.mockReset();
    mocks.listWhatsAppRecipients.mockReset();
    mocks.createWhatsAppRecipient.mockReset();
    mocks.requireAdminApi.mockResolvedValue({ ok: true, admin: { id: "admin-1" } });
  });

  it("returns serialized whatsapp settings", async () => {
    mocks.getWhatsAppSettings.mockResolvedValue(makeSettings());

    const response = await getSettings();
    const payload = (await response.json()) as { webhookPath: string; inboundMode: string };

    expect(response.status).toBe(200);
    expect(payload.webhookPath).toBe("/api/integrations/whatsapp/webhook");
    expect(payload.inboundMode).toBe("OFF");
  });

  it("updates whatsapp settings", async () => {
    mocks.getWhatsAppSettings.mockResolvedValue(makeSettings());

    const response = await putSettings(
      new Request("http://localhost/api/admin/whatsapp/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          notifyOnConfirm: true,
          notifyOnCancel: true,
          confirmTemplate: "{{playerName}} confirmou",
          cancelTemplate: "{{playerName}} cancelou",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateWhatsAppSettings).toHaveBeenCalledTimes(1);
  });

  it("lists recipients", async () => {
    mocks.listWhatsAppRecipients.mockResolvedValue([
      { id: "recipient-1", label: "Marcio", phoneE164: "+5551999999999", isActive: true, lastTestAt: null },
    ]);

    const response = await getRecipients();
    const payload = (await response.json()) as Array<{ id: string }>;

    expect(response.status).toBe(200);
    expect(payload).toHaveLength(1);
  });

  it("creates a recipient", async () => {
    mocks.createWhatsAppRecipient.mockResolvedValue({
      id: "recipient-1",
      label: "Marcio",
      phoneE164: "+5551999999999",
      isActive: true,
      lastTestAt: null,
    });

    const response = await postRecipients(
      new Request("http://localhost/api/admin/whatsapp/recipients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "Marcio", phone: "+5551999999999", isActive: true }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.createWhatsAppRecipient).toHaveBeenCalledWith({
      label: "Marcio",
      phone: "+5551999999999",
      isActive: true,
    });
  });
});
