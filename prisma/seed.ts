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
  icon: string;
  movementType: MovementTypeCode;
};

// icon values are Ionicons names (https://ionic.io/ionicons) — the frontend
// renders these directly, the backend just stores/validates the string.
const DEFAULT_CATEGORIES: SeedCategory[] = [
  { name: 'Supermercado', icon: 'cart-outline', movementType: 'MT01' },
  { name: 'Transporte', icon: 'car-outline', movementType: 'MT01' },
  { name: 'Alquiler', icon: 'home-outline', movementType: 'MT01' },
  { name: 'Servicios', icon: 'flash-outline', movementType: 'MT01' },
  { name: 'Salud', icon: 'medkit-outline', movementType: 'MT01' },
  { name: 'Entretenimiento', icon: 'film-outline', movementType: 'MT01' },
  { name: 'Restaurantes', icon: 'restaurant-outline', movementType: 'MT01' },
  { name: 'Ropa', icon: 'shirt-outline', movementType: 'MT01' },
  { name: 'Sueldo', icon: 'briefcase-outline', movementType: 'MT02' },
  { name: 'Freelance', icon: 'laptop-outline', movementType: 'MT02' },
  { name: 'Inversiones', icon: 'trending-up-outline', movementType: 'MT02' },
  { name: 'Regalos', icon: 'gift-outline', movementType: 'MT02' },
  { name: 'Ahorro', icon: 'wallet-outline', movementType: 'MT03' },
  { name: 'Pago de tarjeta', icon: 'card-outline', movementType: 'MT03' },
  {
    name: 'Entre cuentas',
    icon: 'swap-horizontal-outline',
    movementType: 'MT03',
  },
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
        icon: category.icon,
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
