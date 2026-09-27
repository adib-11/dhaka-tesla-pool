import { PrismaClient } from '@prisma/client';
import { seedBase, seedHistory } from './seed-data';

const prisma = new PrismaClient();

async function main() {
  // Idempotent: the container runs this on every start.
  if (await prisma.user.count()) {
    console.log('Database already seeded, skipping');
    return;
  }
  await prisma.$transaction(
    async (tx) => {
      await seedBase(tx);
      await seedHistory(tx);
    },
    { timeout: 30_000 },
  );
  console.log('Seeded the Banani rush-hour cast');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
