import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.matchRating.deleteMany({});
  console.log(`Votos removidos com sucesso: ${result.count}`);
}

main()
  .catch((error) => {
    console.error("Falha ao remover votos:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
