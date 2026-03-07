import { describe, expect, it } from "vitest";
import { normalizePhoneToE164, renderWhatsAppTemplate } from "@/lib/whatsapp";

describe("whatsapp utils", () => {
  it("normalizes brazil phone numbers to E.164", () => {
    expect(normalizePhoneToE164("(51) 99999-9999")).toBe("+5551999999999");
  });

  it("preserves international numbers already in E.164", () => {
    expect(normalizePhoneToE164("+14155552671")).toBe("+14155552671");
  });

  it("renders placeholders in template", () => {
    const rendered = renderWhatsAppTemplate(
      "{{playerName}} confirmou para {{matchDate}} as {{startTime}} em {{location}}.",
      {
        playerName: "Marcio",
        matchDate: "07/03/2026",
        startTime: "19:00",
        location: "Arena",
      },
    );

    expect(rendered).toContain("Marcio confirmou");
    expect(rendered).toContain("07/03/2026");
    expect(rendered).toContain("Arena");
  });
});
