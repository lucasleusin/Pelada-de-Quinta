import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { createUserActionToken } from "@/lib/auth-tokens";
import { getPrismaClient } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/auth-email";
import { ensureUserHasLinkedPlayer } from "@/lib/user-player-link";
import { registrationSchema } from "@/lib/validators";

const db = () => getPrismaClient();

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registrationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const user = await db().$transaction(async (tx) => {
      const createdUser = await tx.user.create({
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

      await ensureUserHasLinkedPlayer(tx, createdUser.id);

      return createdUser;
    });

    const { rawToken } = await createUserActionToken(user.id, "verify");
    await sendVerificationEmail(user.email, rawToken);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ja existe uma conta com este email." }, { status: 409 });
    }

    if (error instanceof Error && error.message.startsWith("Ja existe um jogador")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "Nao foi possivel concluir o cadastro.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
