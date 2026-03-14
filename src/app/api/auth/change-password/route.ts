import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { requireAuthenticatedApi } from "@/lib/auth-user";
import { getPrismaClient } from "@/lib/db";
import { changePasswordSchema } from "@/lib/validators";

const db = () => getPrismaClient();

export async function POST(request: Request) {
  const authCheck = await requireAuthenticatedApi();
  if (!authCheck.ok) return authCheck.response;

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await db().user.update({
    where: { id: authCheck.user.id },
    data: {
      passwordHash: await hash(parsed.data.password, 10),
      mustChangePassword: false,
    },
  });

  return NextResponse.json({ ok: true });
}
