import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { createUserActionToken } from "@/lib/auth-tokens";
import { getPrismaClient } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/auth-email";
import { registrationSchema } from "@/lib/validators";

const db = () => getPrismaClient();

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registrationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const user = await db().user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await hash(parsed.data.password, 10),
        status: "PENDING_VERIFICATION",
        role: "PLAYER",
        nickname: parsed.data.nickname ?? null,
        position: parsed.data.position ?? null,
        shirtNumberPreference: parsed.data.shirtNumberPreference ?? null,
        whatsApp: parsed.data.whatsApp ?? null,
      },
    });

    const { rawToken } = await createUserActionToken(user.id, "verify");
    await sendVerificationEmail(user.email, rawToken);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ja existe uma conta com este email." }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "Nao foi possivel concluir o cadastro.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
