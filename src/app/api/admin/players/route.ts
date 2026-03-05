import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin";
import { playerCreateSchema } from "@/lib/validators";

type PrismaUniqueErrorLike = {
  code?: string;
  meta?: {
    target?: unknown;
  };
};

function isUniqueConstraintError(error: unknown): error is PrismaUniqueErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as PrismaUniqueErrorLike).code === "P2002"
  );
}

function uniqueConstraintMessage(error: PrismaUniqueErrorLike) {
  const target = Array.isArray(error.meta?.target) ? error.meta?.target : [];

  if (target.includes("email")) {
    return "Email ja esta em uso por outro jogador.";
  }

  if (target.includes("name")) {
    return "Nome ja esta em uso por outro jogador.";
  }

  return "Dados duplicados.";
}

export async function POST(request: Request) {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await request.json().catch(() => null);
  const parsed = playerCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const prisma = getPrismaClient();
  try {
    const player = await prisma.player.create({
      data: {
        name: parsed.data.name,
        position: parsed.data.position,
        shirtNumberPreference: parsed.data.shirtNumberPreference ?? null,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        isActive: parsed.data.isActive ?? true,
      },
    });

    return NextResponse.json(player, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: uniqueConstraintMessage(error) }, { status: 409 });
    }

    return NextResponse.json({ error: "Nao foi possivel criar jogador." }, { status: 500 });
  }
}
