import { NextResponse } from "next/server";
import { createUserActionToken } from "@/lib/auth-tokens";
import { getPrismaClient } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/auth-email";
import { forgotPasswordSchema } from "@/lib/validators";

const db = () => getPrismaClient();

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await db().user.findUnique({
    where: { email: parsed.data.email },
  });

  if (user?.passwordHash) {
    const { rawToken } = await createUserActionToken(user.id, "reset");
    await sendPasswordResetEmail(user.email, rawToken);
  }

  return NextResponse.json({ ok: true });
}
