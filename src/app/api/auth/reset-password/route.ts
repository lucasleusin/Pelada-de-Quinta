import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { consumeUserActionToken } from "@/lib/auth-tokens";
import { getPrismaClient } from "@/lib/db";
import { resetPasswordSchema } from "@/lib/validators";

const db = () => getPrismaClient();

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const token = await consumeUserActionToken(parsed.data.token, "reset");

  if (!token) {
    return NextResponse.json({ error: "Token invalido ou expirado." }, { status: 400 });
  }

  await db().user.update({
    where: { id: token.userId },
    data: {
      passwordHash: await hash(parsed.data.password, 10),
    },
  });

  return NextResponse.json({ ok: true });
}
