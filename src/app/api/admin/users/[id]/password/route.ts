import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth-user";
import { getPrismaClient } from "@/lib/db";
import { adminSetPasswordSchema } from "@/lib/validators";

const db = () => getPrismaClient();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = adminSetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await db().user.findUnique({
    where: { id },
    select: {
      id: true,
      mergedIntoUserId: true,
    },
  });

  if (!user || user.mergedIntoUserId) {
    return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  }

  await db().$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hash(parsed.data.password, 10),
        mustChangePassword: false,
        sessionVersion: {
          increment: 1,
        },
      },
    });

    await tx.session.deleteMany({
      where: { userId: user.id },
    });
  });

  return NextResponse.json({ ok: true });
}
