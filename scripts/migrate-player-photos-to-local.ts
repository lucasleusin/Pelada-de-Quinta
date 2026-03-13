import { PrismaClient } from "@prisma/client";
import { buildPublicPhotoUrl, getPhotoStorageDriver, storePhoto } from "../src/lib/photo-storage";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const overwrite = process.argv.includes("--overwrite");

function getFallbackContentType(photoPath: string) {
  const normalized = photoPath.toLowerCase();

  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";

  return "application/octet-stream";
}

async function main() {
  if (getPhotoStorageDriver() !== "local") {
    throw new Error("Defina PHOTO_STORAGE_DRIVER=local antes de rodar este script.");
  }

  const players = await prisma.player.findMany({
    where: {
      photoPath: {
        not: null,
      },
      photoUrl: {
        not: null,
      },
    },
    select: {
      id: true,
      name: true,
      photoPath: true,
      photoUrl: true,
    },
  });

  let migrated = 0;
  let skipped = 0;

  for (const player of players) {
    if (!player.photoPath || !player.photoUrl) {
      skipped += 1;
      continue;
    }

    const nextPhotoUrl = buildPublicPhotoUrl(player.photoPath);

    if (player.photoUrl === nextPhotoUrl && !overwrite) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] ${player.name}: baixar ${player.photoUrl} -> ${player.photoPath}`);
      migrated += 1;
      continue;
    }

    const response = await fetch(player.photoUrl);

    if (!response.ok) {
      throw new Error(`Falha ao baixar ${player.photoUrl}: HTTP ${response.status}`);
    }

    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim() || getFallbackContentType(player.photoPath);
    const data = Buffer.from(await response.arrayBuffer());

    await storePhoto({
      photoPath: player.photoPath,
      data,
      contentType,
    });

    await prisma.player.update({
      where: { id: player.id },
      data: { photoUrl: nextPhotoUrl },
    });

    migrated += 1;
  }

  console.log(
    dryRun
      ? `Dry-run concluido. ${migrated} foto(s) seriam migradas e ${skipped} ignoradas.`
      : `Migracao concluida. ${migrated} foto(s) migradas e ${skipped} ignoradas.`,
  );
}

main()
  .catch((error) => {
    console.error("Falha ao migrar fotos para o storage local.", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
