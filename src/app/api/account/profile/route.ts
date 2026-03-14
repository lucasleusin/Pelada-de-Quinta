import { Prisma, UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { createUserActionToken } from "@/lib/auth-tokens";
import { sendVerificationEmail } from "@/lib/auth-email";
import { requireAuthenticatedApi } from "@/lib/auth-user";
import { getPrismaClient } from "@/lib/db";
import { accountProfileUpdateSchema } from "@/lib/validators";

const db = () => getPrismaClient();

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function GET() {
  const authCheck = await requireAuthenticatedApi();
  if (!authCheck.ok) return authCheck.response;

  return NextResponse.json({
    id: authCheck.user.id,
    name: authCheck.user.name,
    email: authCheck.user.email,
    nickname: authCheck.user.nickname,
    position: authCheck.user.position,
    shirtNumberPreference: authCheck.user.shirtNumberPreference,
    whatsApp: authCheck.user.whatsApp,
    role: authCheck.user.role,
    status: authCheck.user.status,
    playerId: authCheck.user.playerId,
    mustChangePassword: authCheck.user.mustChangePassword,
    emailVerified: authCheck.user.emailVerified,
  });
}

export async function PUT(request: Request) {
  const authCheck = await requireAuthenticatedApi();
  if (!authCheck.ok) return authCheck.response;

  const body = await request.json().catch(() => null);
  const parsed = accountProfileUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const nextEmail = parsed.data.email?.trim().toLowerCase();
  const emailChanged = Boolean(nextEmail && nextEmail !== authCheck.user.email);

  const updateData: Prisma.UserUpdateInput = {
    name: parsed.data.name,
    nickname: parsed.data.nickname,
    position: parsed.data.position,
    shirtNumberPreference: parsed.data.shirtNumberPreference,
    whatsApp: parsed.data.whatsApp,
  };

  if (nextEmail) {
    updateData.email = nextEmail;
  }

  if (emailChanged) {
    updateData.emailVerified = null;

    if (authCheck.user.status !== UserStatus.DISABLED && authCheck.user.status !== UserStatus.REJECTED) {
      updateData.status = UserStatus.PENDING_VERIFICATION;
    }
  }

  try {
    const updatedUser = await db().user.update({
      where: { id: authCheck.user.id },
      data: updateData,
    });

    if (emailChanged) {
      const { rawToken } = await createUserActionToken(updatedUser.id, "verify");
      await sendVerificationEmail(updatedUser.email, rawToken);
    }

    return NextResponse.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      nickname: updatedUser.nickname,
      position: updatedUser.position,
      shirtNumberPreference: updatedUser.shirtNumberPreference,
      whatsApp: updatedUser.whatsApp,
      role: updatedUser.role,
      status: updatedUser.status,
      playerId: updatedUser.playerId,
      mustChangePassword: updatedUser.mustChangePassword,
      emailVerified: updatedUser.emailVerified,
      verificationEmailSent: emailChanged,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Ja existe uma conta com este email." }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "Nao foi possivel atualizar seus dados.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
