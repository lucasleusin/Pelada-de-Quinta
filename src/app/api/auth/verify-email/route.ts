import { NextResponse } from "next/server";
import { consumeUserActionToken } from "@/lib/auth-tokens";
import { getPrismaClient } from "@/lib/db";
import { verificationTokenSchema } from "@/lib/validators";

const db = () => getPrismaClient();

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = verificationTokenSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const token = await consumeUserActionToken(parsed.data.token, "verify");

  if (!token) {
    return NextResponse.json({ error: "Token invalido ou expirado." }, { status: 400 });
  }

  const user = await db().user.findUnique({
    where: { id: token.userId },
    select: {
      status: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Conta nao encontrada." }, { status: 404 });
  }

  await db().user.update({
    where: { id: token.userId },
    data: {
      emailVerified: new Date(),
      status:
        user.status === "REJECTED" || user.status === "DISABLED"
          ? user.status
          : "PENDING_APPROVAL",
    },
  });

  return NextResponse.json({ ok: true });
}
