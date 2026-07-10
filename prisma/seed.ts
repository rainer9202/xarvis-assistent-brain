import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/infrastructure/config/database/generated/prisma/client.js';
import { MOVEMENT_TYPES } from '../src/domain/enums/movement-type.enum.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEFAULT_USER = {
  name: 'Rainer Gonzalez',
  email: 'rainer@gmail.com',
  password: 'rainer.123',
};

type SeedCategory = {
  name: string;
  movementType: (typeof MOVEMENT_TYPES)[number];
};

const DEFAULT_CATEGORIES: SeedCategory[] = [
  { name: 'Supermercado', movementType: 'Gasto' },
  { name: 'Transporte', movementType: 'Gasto' },
  { name: 'Alquiler', movementType: 'Gasto' },
  { name: 'Servicios', movementType: 'Gasto' },
  { name: 'Salud', movementType: 'Gasto' },
  { name: 'Entretenimiento', movementType: 'Gasto' },
  { name: 'Restaurantes', movementType: 'Gasto' },
  { name: 'Ropa', movementType: 'Gasto' },
  { name: 'Sueldo', movementType: 'Ingreso' },
  { name: 'Freelance', movementType: 'Ingreso' },
  { name: 'Inversiones', movementType: 'Ingreso' },
  { name: 'Regalos', movementType: 'Ingreso' },
  { name: 'Ahorro', movementType: 'Transferencia' },
  { name: 'Pago de tarjeta', movementType: 'Transferencia' },
  { name: 'Entre cuentas', movementType: 'Transferencia' },
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
