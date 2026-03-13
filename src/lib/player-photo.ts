export const ALLOWED_PLAYER_PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_PLAYER_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

export function getPlayerPhotoExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return null;
}

export function buildPlayerPhotoPath(playerId: string, mimeType: string, timestamp = Date.now()) {
  const extension = getPlayerPhotoExtension(mimeType);

  if (!extension) {
    throw new Error("Formato invalido.");
  }

  return `players/${playerId}/${timestamp}.${extension}`;
}

export function validatePlayerPhotoFile(fileLike: FormDataEntryValue | null | undefined) {
  if (!(fileLike instanceof File)) {
    return "Arquivo invalido.";
  }

  if (!ALLOWED_PLAYER_PHOTO_MIME_TYPES.has(fileLike.type)) {
    return "Formato invalido. Envie JPG, PNG ou WEBP.";
  }

  if (fileLike.size > MAX_PLAYER_PHOTO_SIZE_BYTES) {
    return "Arquivo muito grande. Limite de 5MB.";
  }

  return null;
}
