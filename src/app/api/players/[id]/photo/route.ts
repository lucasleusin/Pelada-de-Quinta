import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/db";
import { deletePhoto, storePhoto } from "@/lib/photo-storage";
import { buildPlayerPhotoPath, validatePlayerPhotoFile } from "@/lib/player-photo";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const prisma = getPrismaClient();

    const player = await prisma.player.findFirst({
      where: {
        id,
        isActive: true,
      },
      select: { id: true, photoPath: true },
    });

    if (!player) {
      return NextResponse.json({ error: "Jogador ativo nao encontrado." }, { status: 404 });
    }

    const formData = await request.formData().catch(() => null);
    const fileLike = formData?.get("file");
    const validationError = validatePlayerPhotoFile(fileLike);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const file = fileLike as File;
    const path = buildPlayerPhotoPath(player.id, file.type);
    const data = Buffer.from(await file.arrayBuffer());
    const storedPhoto = await storePhoto({
      photoPath: path,
      data,
      contentType: file.type,
    });

    if (player.photoPath && player.photoPath !== path) {
      await deletePhoto(player.photoPath);
    }

    const updated = await prisma.player.update({
      where: { id: player.id },
      data: {
        photoPath: storedPhoto.photoPath,
        photoUrl: storedPhoto.photoUrl,
      },
      select: { id: true, photoPath: true, photoUrl: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao enviar foto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const prisma = getPrismaClient();

    const player = await prisma.player.findFirst({
      where: {
        id,
        isActive: true,
      },
      select: { id: true, photoPath: true },
    });

    if (!player) {
      return NextResponse.json({ error: "Jogador ativo nao encontrado." }, { status: 404 });
    }

    if (player.photoPath) {
      await deletePhoto(player.photoPath);
    }

    await prisma.player.update({
      where: { id: player.id },
      data: {
        photoPath: null,
        photoUrl: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao remover foto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
