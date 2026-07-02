import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/config/database/generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEFAULT_MOVEMENT_TYPES = ['expense', 'income', 'transfer'];

async function main() {
  for (const name of DEFAULT_MOVEMENT_TYPES) {
    await prisma.movementType.upsert({
      where: { name },
      update: {},
      create: { name, isDefault: true },
    });
  }
  console.log('Seed completed: default movement types created');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
