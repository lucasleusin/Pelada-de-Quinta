import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth-user";
import { getPrismaClient } from "@/lib/db";
import { executeEntityMerge, listMergeCandidates, MergeValidationError, previewEntityMerge } from "@/lib/user-merge";
import { mergeEntitiesSchema } from "@/lib/validators";

const db = () => getPrismaClient();

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof MergeValidationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET() {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const payload = await listMergeCandidates(db());
  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const adminCheck = await requireAdminApi();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await request.json().catch(() => null);
  const parsed = mergeEntitiesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    if (parsed.data.action === "preview") {
      const preview = await previewEntityMerge(db(), parsed.data);
      return NextResponse.json(preview);
    }

    const result = await executeEntityMerge(db(), adminCheck.user.id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Nao foi possivel concluir a unificacao.");
  }
}
