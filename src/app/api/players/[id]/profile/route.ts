import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-user";
import { getPrismaClient } from "@/lib/db";
import { playerProfileUpdateSchema } from "@/lib/validators";

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
  const { id } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.status !== "ACTIVE" || !currentUser.playerId) {
    return NextResponse.json({ error: "Cadastro pendente de aprovacao." }, { status: 403 });
  }

  const requestedId = id === "me" ? currentUser.playerId : id;

  if (requestedId !== currentUser.playerId) {
    return NextResponse.json({ error: "Acesso negado ao perfil solicitado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = playerProfileUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const prisma = getPrismaClient();
  const existingPlayer = await prisma.player.findFirst({
    where: {
      id: requestedId,
      isActive: true,
      mergedIntoPlayerId: null,
    },
    select: {
      id: true,
    },
  });

  if (!existingPlayer) {
    return NextResponse.json({ error: "Jogador ativo nao encontrado." }, { status: 404 });
  }

  try {
    const player = await prisma.$transaction(async (tx) => {
      const updatedPlayer = await tx.player.update({
        where: { id: requestedId },
        data: parsed.data,
      });

      await tx.user.update({
        where: { id: currentUser.id },
        data: {
          name: updatedPlayer.name,
          nickname: updatedPlayer.nickname,
        },
      });

      return updatedPlayer;
    });

    return NextResponse.json(player);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: uniqueConstraintMessage(error) }, { status: 409 });
    }

    return NextResponse.json({ error: "Nao foi possivel atualizar perfil." }, { status: 500 });
  }
}
