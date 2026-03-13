import path from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { getSupabaseAdminClient, PLAYER_PHOTOS_BUCKET } from "@/lib/supabase-admin";

export type PhotoStorageDriver = "local" | "supabase";

type UploadPhotoInput = {
  photoPath: string;
  data: Buffer;
  contentType: string;
};

type StoredPhoto = {
  photoPath: string;
  photoUrl: string;
};

const DEFAULT_LOCAL_STORAGE_DIR = path.join(process.cwd(), "storage", "player-photos");
const DEFAULT_PUBLIC_BASE_PATH = "/uploads";

function normalizePathSegment(segment: string) {
  const trimmed = segment.trim();

  if (!trimmed || trimmed === "." || trimmed === "..") {
    throw new Error("Caminho de foto invalido.");
  }

  if (trimmed.includes("\\") || trimmed.includes("\0")) {
    throw new Error("Caminho de foto invalido.");
  }

  return trimmed;
}

export function normalizePhotoPath(input: string | string[]) {
  const rawParts = Array.isArray(input) ? input : input.split("/");
  const parts = rawParts.filter(Boolean).map(normalizePathSegment);

  if (parts.length === 0) {
    throw new Error("Caminho de foto invalido.");
  }

  return parts.join("/");
}

function getLocalStorageRoot() {
  return process.env.PHOTO_STORAGE_DIR?.trim() || DEFAULT_LOCAL_STORAGE_DIR;
}

function getPublicBasePath() {
  const configured = process.env.PHOTO_PUBLIC_BASE_PATH?.trim() || DEFAULT_PUBLIC_BASE_PATH;
  const normalized = configured.startsWith("/") ? configured : `/${configured}`;
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

export function getPhotoStorageDriver(): PhotoStorageDriver {
  const configured = process.env.PHOTO_STORAGE_DRIVER?.trim().toLowerCase();

  if (configured === "local" || configured === "supabase") {
    return configured;
  }

  if (configured) {
    throw new Error("PHOTO_STORAGE_DRIVER deve ser 'local' ou 'supabase'.");
  }

  const hasSupabaseEnv =
    Boolean(process.env.SUPABASE_URL?.trim()) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

  return hasSupabaseEnv ? "supabase" : "local";
}

export function buildPublicPhotoUrl(photoPath: string) {
  const normalizedPath = normalizePhotoPath(photoPath);
  return `${getPublicBasePath()}/${normalizedPath}`;
}

function getAbsoluteLocalPhotoPath(photoPath: string) {
  const normalizedPath = normalizePhotoPath(photoPath);
  const parts = normalizedPath.split("/");
  return path.join(getLocalStorageRoot(), ...parts);
}

function getContentTypeFromExtension(photoPath: string) {
  const extension = path.extname(photoPath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".ico") return "image/x-icon";

  return "application/octet-stream";
}

async function storeLocalPhoto(input: UploadPhotoInput): Promise<StoredPhoto> {
  const absolutePath = getAbsoluteLocalPhotoPath(input.photoPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.data);

  return {
    photoPath: normalizePhotoPath(input.photoPath),
    photoUrl: buildPublicPhotoUrl(input.photoPath),
  };
}

async function removeLocalPhoto(photoPath: string) {
  const absolutePath = getAbsoluteLocalPhotoPath(photoPath);
  await rm(absolutePath, { force: true });
}

async function storeSupabasePhoto(input: UploadPhotoInput): Promise<StoredPhoto> {
  const normalizedPath = normalizePhotoPath(input.photoPath);
  const supabase = getSupabaseAdminClient();

  const upload = await supabase.storage.from(PLAYER_PHOTOS_BUCKET).upload(normalizedPath, input.data, {
    contentType: input.contentType,
    upsert: true,
  });

  if (upload.error) {
    throw new Error(`Falha ao enviar foto: ${upload.error.message}`);
  }

  const { data: urlData } = supabase.storage.from(PLAYER_PHOTOS_BUCKET).getPublicUrl(normalizedPath);

  return {
    photoPath: normalizedPath,
    photoUrl: urlData.publicUrl,
  };
}

async function removeSupabasePhoto(photoPath: string) {
  const normalizedPath = normalizePhotoPath(photoPath);
  const supabase = getSupabaseAdminClient();
  const remove = await supabase.storage.from(PLAYER_PHOTOS_BUCKET).remove([normalizedPath]);

  if (remove.error) {
    throw new Error(`Falha ao remover foto: ${remove.error.message}`);
  }
}

export async function storePhoto(input: UploadPhotoInput): Promise<StoredPhoto> {
  const driver = getPhotoStorageDriver();

  if (driver === "supabase") {
    return storeSupabasePhoto(input);
  }

  return storeLocalPhoto(input);
}

export async function deletePhoto(photoPath: string | null | undefined) {
  if (!photoPath) {
    return;
  }

  const driver = getPhotoStorageDriver();

  if (driver === "supabase") {
    await removeSupabasePhoto(photoPath);
    return;
  }

  await removeLocalPhoto(photoPath);
}

export async function readLocalPhoto(photoPath: string) {
  const absolutePath = getAbsoluteLocalPhotoPath(photoPath);
  const data = await readFile(absolutePath);

  return {
    data,
    contentType: getContentTypeFromExtension(photoPath),
  };
}
