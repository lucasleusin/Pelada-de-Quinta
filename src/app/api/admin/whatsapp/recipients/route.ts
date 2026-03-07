import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { createWhatsAppRecipient, listWhatsAppRecipients } from "@/lib/whatsapp-service";
import { whatsAppRecipientCreateSchema } from "@/lib/validators";

function mapError(error: unknown) {
  if (error instanceof Error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes("cadastrado") ? 409 : 400 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return NextResponse.json({ error: "Falha ao salvar destinatario." }, { status: 400 });
  }

  return NextResponse.json({ error: "Falha ao salvar destinatario." }, { status: 500 });
}

export async function GET() {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const recipients = await listWhatsAppRecipients();
  return NextResponse.json(recipients);
}

export async function POST(request: Request) {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await request.json().catch(() => null);
  const parsed = whatsAppRecipientCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const recipient = await createWhatsAppRecipient(parsed.data);
    return NextResponse.json(recipient, { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}
