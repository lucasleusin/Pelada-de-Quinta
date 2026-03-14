import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin";
import { playerUpdateSchema } from "@/lib/validators";

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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = playerUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const prisma = getPrismaClient();

  const existingPlayer = await prisma.player.findFirst({
    where: {
      id,
      mergedIntoPlayerId: null,
    },
    select: { id: true },
  });

  if (!existingPlayer) {
    return NextResponse.json({ error: "Jogador nao encontrado." }, { status: 404 });
  }

  try {
    const player = await prisma.player.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(player);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: uniqueConstraintMessage(error) }, { status: 409 });
    }

    return NextResponse.json({ error: "Nao foi possivel atualizar jogador." }, { status: 500 });
  }
}
