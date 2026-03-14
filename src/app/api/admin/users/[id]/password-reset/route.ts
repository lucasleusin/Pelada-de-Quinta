import { hash } from "bcryptjs";
import { UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { createUserActionToken } from "@/lib/auth-tokens";
import { sendPasswordResetEmail } from "@/lib/auth-email";
import { requireAdminApi } from "@/lib/auth-user";
import { getPrismaClient } from "@/lib/db";
import { generateTemporaryPassword } from "@/lib/user-management";
import { adminPasswordResetSchema } from "@/lib/validators";

const db = () => getPrismaClient();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = adminPasswordResetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await db().user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      status: true,
      mergedIntoUserId: true,
    },
  });

  if (!user || user.mergedIntoUserId) {
    return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  }

  if (user.status !== UserStatus.ACTIVE) {
    return NextResponse.json({ error: "Somente usuarios ativos podem ter a senha reiniciada." }, { status: 409 });
  }

  if (parsed.data.mode === "email") {
    const { rawToken } = await createUserActionToken(user.id, "reset");
    await sendPasswordResetEmail(user.email, rawToken);
    return NextResponse.json({ ok: true, mode: "email" });
  }

  const temporaryPassword = generateTemporaryPassword();

  await db().$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hash(temporaryPassword, 10),
        mustChangePassword: true,
        sessionVersion: {
          increment: 1,
        },
      },
    });

    await tx.session.deleteMany({
      where: { userId: user.id },
    });
  });

  return NextResponse.json({
    ok: true,
    mode: "temporary",
    temporaryPassword,
  });
}
