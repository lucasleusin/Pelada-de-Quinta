import { WhatsAppMessageEventType } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { sendWhatsAppTest } from "@/lib/whatsapp-service";
import { whatsAppTestSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await request.json().catch(() => null);
  const parsed = whatsAppTestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const notification = await sendWhatsAppTest(
      parsed.data.recipientId,
      parsed.data.eventType === "CANCEL" ? WhatsAppMessageEventType.CANCEL : WhatsAppMessageEventType.CONFIRM,
    );

    return NextResponse.json(notification);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Falha ao enviar teste." }, { status: 500 });
  }
}
