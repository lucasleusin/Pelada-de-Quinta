import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/db";
import { getSupabaseAdminClient, PLAYER_PHOTOS_BUCKET } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function extFromMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return null;
}

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

    if (!(fileLike instanceof File)) {
      return NextResponse.json({ error: "Arquivo invalido." }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(fileLike.type)) {
      return NextResponse.json({ error: "Formato invalido. Envie JPG, PNG ou WEBP." }, { status: 400 });
    }

    if (fileLike.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "Arquivo muito grande. Limite de 5MB." }, { status: 400 });
    }

    const extension = extFromMimeType(fileLike.type);
    if (!extension) {
      return NextResponse.json({ error: "Formato invalido." }, { status: 400 });
    }

    const path = `players/${player.id}/${Date.now()}.${extension}`;
    const data = Buffer.from(await fileLike.arrayBuffer());
    const supabase = getSupabaseAdminClient();

    const upload = await supabase.storage.from(PLAYER_PHOTOS_BUCKET).upload(path, data, {
      contentType: fileLike.type,
      upsert: true,
    });

    if (upload.error) {
      return NextResponse.json({ error: `Falha ao enviar foto: ${upload.error.message}` }, { status: 500 });
    }

    if (player.photoPath && player.photoPath !== path) {
      await supabase.storage.from(PLAYER_PHOTOS_BUCKET).remove([player.photoPath]);
    }

    const { data: urlData } = supabase.storage.from(PLAYER_PHOTOS_BUCKET).getPublicUrl(path);

    const updated = await prisma.player.update({
      where: { id: player.id },
      data: {
        photoPath: path,
        photoUrl: urlData.publicUrl,
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
      const supabase = getSupabaseAdminClient();
      const remove = await supabase.storage.from(PLAYER_PHOTOS_BUCKET).remove([player.photoPath]);
      if (remove.error) {
        return NextResponse.json({ error: `Falha ao remover foto: ${remove.error.message}` }, { status: 500 });
      }
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
