import { NextResponse } from "next/server";
import { readLocalPhoto, getPhotoStorageDriver, normalizePhotoPath } from "@/lib/photo-storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    if (getPhotoStorageDriver() !== "local") {
      return NextResponse.json({ error: "Arquivo nao encontrado." }, { status: 404 });
    }

    const { path } = await params;
    const photoPath = normalizePhotoPath(path);
    const photo = await readLocalPhoto(photoPath);

    return new NextResponse(photo.data, {
      status: 200,
      headers: {
        "content-type": photo.contentType,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Arquivo nao encontrado." }, { status: 404 });
  }
}
