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
  await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      siteName: "Pelada da Quinta",
      siteShortName: "CH-RS - Pelada",
      siteDescription: "Gestao da pelada semanal de Cachoeira do Sul",
      locationLabel: "Cachoeira do Sul",
      headerBadge: "Gestao Semanal",
    },
  });

  const email = process.env.ADMIN_SEED_EMAIL ?? "marcio";
  const password = process.env.ADMIN_SEED_PASSWORD ?? "sop";
  const passwordHash = await hash(password, 10);
  const adminPlayerName = "Administrador";
  const existingAdminPlayer = await prisma.player.findFirst({
    where: {
      OR: [
        { email },
        { name: adminPlayerName, user: { is: null } },
      ],
    },
  });

  const adminPlayer = existingAdminPlayer
    ? await prisma.player.update({
        where: { id: existingAdminPlayer.id },
        data: {
          name: adminPlayerName,
          email,
          position: Position.OUTRO,
          isActive: true,
        },
      })
    : await prisma.player.create({
        data: {
          name: adminPlayerName,
          position: Position.OUTRO,
          email,
          isActive: true,
        },
      });

  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  await prisma.user.upsert({
    where: { email },
    update: {
      name: adminPlayerName,
      emailVerified: new Date(),
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      playerId: adminPlayer.id,
    },
    create: {
      name: adminPlayerName,
      email,
      emailVerified: new Date(),
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      playerId: adminPlayer.id,
    },
  });

  for (const [name, position, shirtNumberPreference] of players) {
    const existingPlayer = await prisma.player.findFirst({
      where: {
        name,
        email: null,
        user: { is: null },
      },
      orderBy: { createdAt: "asc" },
    });

    if (existingPlayer) {
      await prisma.player.update({
        where: { id: existingPlayer.id },
        data: { position, shirtNumberPreference, isActive: true },
      });
      continue;
    }

    await prisma.player.create({
      data: { name, position, shirtNumberPreference, isActive: true },
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
