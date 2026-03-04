import { hash } from "bcryptjs";
import { PrismaClient, Position } from "@prisma/client";

const prisma = new PrismaClient();

const players = [
  ["Lucas", Position.MEIA, 10],
  ["Rafael", Position.ATACANTE, 9],
  ["Bruno", Position.ZAGUEIRO, 4],
  ["Gabriel", Position.MEIA, 8],
  ["Tiago", Position.GOLEIRO, 1],
  ["Fernando", Position.ZAGUEIRO, 3],
  ["Joao", Position.MEIA, 11],
  ["Mateus", Position.ATACANTE, 7],
  ["Eduardo", Position.ZAGUEIRO, 2],
  ["Henrique", Position.MEIA, 5],
  ["Andre", Position.ATACANTE, 17],
  ["Vitor", Position.OUTRO, 14],
  ["Marcelo", Position.MEIA, 6],
  ["Diego", Position.ATACANTE, 18],
  ["Samuel", Position.ZAGUEIRO, 15],
  ["Ricardo", Position.GOLEIRO, 12],
  ["Leandro", Position.OUTRO, 16],
  ["Gustavo", Position.MEIA, 13],
  ["Caio", Position.ATACANTE, 19],
  ["Felipe", Position.ZAGUEIRO, 20],
] as const;

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL ?? "marcio";
  const password = process.env.ADMIN_SEED_PASSWORD ?? "sop";
  const passwordHash = await hash(password, 10);

  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  for (const [name, position, shirtNumberPreference] of players) {
    await prisma.player.upsert({
      where: { name },
      update: { position, shirtNumberPreference, isActive: true },
      create: { name, position, shirtNumberPreference, isActive: true },
    });
  }

  console.log("Seed concluido com admin e jogadores de exemplo.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
