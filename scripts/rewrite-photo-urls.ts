import { PrismaClient } from "@prisma/client";
import { buildPublicPhotoUrl } from "../src/lib/photo-storage";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const players = await prisma.player.findMany({
    where: {
      photoPath: {
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

  let changed = 0;

  for (const player of players) {
    if (!player.photoPath) {
      continue;
    }

    const nextPhotoUrl = buildPublicPhotoUrl(player.photoPath);

    if (player.photoUrl === nextPhotoUrl) {
      continue;
    }

    changed += 1;

    if (dryRun) {
      console.log(`[dry-run] ${player.name}: ${player.photoUrl ?? "<null>"} -> ${nextPhotoUrl}`);
      continue;
    }

    await prisma.player.update({
      where: { id: player.id },
      data: { photoUrl: nextPhotoUrl },
    });
  }

  console.log(
    dryRun
      ? `Dry-run concluido. ${changed} jogador(es) teriam a URL reescrita.`
      : `Reescrita concluida. ${changed} jogador(es) atualizados.`,
  );
}

main()
  .catch((error) => {
    console.error("Falha ao reescrever URLs das fotos.", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
