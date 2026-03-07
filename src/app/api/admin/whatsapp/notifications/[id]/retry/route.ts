import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { retryWhatsAppMessageLog } from "@/lib/whatsapp-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const { id } = await params;
    const notification = await retryWhatsAppMessageLog(id);
    return NextResponse.json(notification);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Notificacao nao encontrada." }, { status: 404 });
    }

    if (error instanceof Error && error.message.includes("nao encontrado")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: "Falha ao reenviar notificacao." }, { status: 500 });
  }
}
