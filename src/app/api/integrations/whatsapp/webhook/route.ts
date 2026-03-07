import { NextResponse } from "next/server";
import { validateTwilioWebhookRequest } from "@/lib/whatsapp";

export async function POST(request: Request) {
  const validSignature = await validateTwilioWebhookRequest(request);

  if (!validSignature) {
    return NextResponse.json({ error: "Assinatura Twilio invalida." }, { status: 401 });
  }

  return NextResponse.json(
    {
      error: "Webhook inbound reservado para fase futura.",
      inboundMode: "OFF",
    },
    { status: 501 },
  );
}
