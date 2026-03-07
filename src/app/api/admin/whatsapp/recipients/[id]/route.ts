import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { deleteWhatsAppRecipient, updateWhatsAppRecipient } from "@/lib/whatsapp-service";
import { whatsAppRecipientUpdateSchema } from "@/lib/validators";

function mapError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return NextResponse.json({ error: "Destinatario nao encontrado." }, { status: 404 });
  }

  if (error instanceof Error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes("cadastrado") ? 409 : 400 },
    );
  }

  return NextResponse.json({ error: "Falha ao atualizar destinatario." }, { status: 500 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await request.json().catch(() => null);
  const parsed = whatsAppRecipientUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { id } = await params;
    const recipient = await updateWhatsAppRecipient(id, parsed.data);
    return NextResponse.json(recipient);
  } catch (error) {
    return mapError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const { id } = await params;
    await deleteWhatsAppRecipient(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapError(error);
  }
}
