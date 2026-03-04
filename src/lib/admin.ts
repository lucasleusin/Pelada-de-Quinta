import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrismaClient } from "@/lib/db";

export async function requireAdminApi() {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Nao autorizado." }, { status: 401 }),
    };
  }

  const prisma = getPrismaClient();
  const admin = await prisma.adminUser.findUnique({ where: { id: session.user.id } });

  if (!admin) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Administrador invalido." }, { status: 401 }),
    };
  }

  return { ok: true as const, admin };
}
