import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/infrastructure/config/database/generated/prisma/client.js';
import type { MovementTypeCode } from '../src/domain/enums/movement-type.enum.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEFAULT_USER = {
  name: 'Rainer Gonzalez',
  email: 'rainer@gmail.com',
  password: 'rainer.123',
};

type SeedCategory = {
  name: string;
  movementType: MovementTypeCode;
};

const DEFAULT_CATEGORIES: SeedCategory[] = [
  { name: 'Supermercado', movementType: 'MT01' },
  { name: 'Transporte', movementType: 'MT01' },
  { name: 'Alquiler', movementType: 'MT01' },
  { name: 'Servicios', movementType: 'MT01' },
  { name: 'Salud', movementType: 'MT01' },
  { name: 'Entretenimiento', movementType: 'MT01' },
  { name: 'Restaurantes', movementType: 'MT01' },
  { name: 'Ropa', movementType: 'MT01' },
  { name: 'Sueldo', movementType: 'MT02' },
  { name: 'Freelance', movementType: 'MT02' },
  { name: 'Inversiones', movementType: 'MT02' },
  { name: 'Regalos', movementType: 'MT02' },
  { name: 'Ahorro', movementType: 'MT03' },
  { name: 'Pago de tarjeta', movementType: 'MT03' },
  { name: 'Entre cuentas', movementType: 'MT03' },
];

async function main() {
  // update: {} — re-running the seed never touches an existing user's
  // password, so it's safe to run repeatedly against a DB where this user
  // already signed up normally.
  const user = await prisma.user.upsert({
    where: { email: DEFAULT_USER.email },
    update: {},
    create: {
      name: DEFAULT_USER.name,
      email: DEFAULT_USER.email,
      password: await argon2.hash(DEFAULT_USER.password),
    },
  });

  for (const category of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: {
        name_movementType_userId: {
          name: category.name,
          movementType: category.movementType,
          userId: user.id,
        },
      },
      update: {},
      create: {
        name: category.name,
        movementType: category.movementType,
        userId: user.id,
      },
    });
  }

  console.log(
    `Seed completed: user "${user.email}" with ${DEFAULT_CATEGORIES.length} categories`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
