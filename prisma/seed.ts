import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
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

// Shape of each record in src/modules/gym-routine-sessions/data/exercises.json
// — see that folder's README.md/exercises.schema.json for provenance/full
// schema. The JSON's own `id` (a zero-padded numeric string) is NOT reused
// as the Prisma id — Prisma generates a fresh uuid() for every seeded row.
type SeedExerciseRecord = {
  id: string;
  name: string;
  name_es: string;
  category: string;
  body_part: string;
  equipment: string;
  instructions: Record<string, string>;
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  image: string;
  gif_url: string;
  attribution: string;
};

const EXERCISES_JSON_PATH = path.join(
  __dirname,
  '../src/modules/gym-routine-sessions/data/exercises.json',
);

async function backfillExerciseNameEs(records: SeedExerciseRecord[]) {
  // Global exercise rows don't preserve the JSON's own `id` (see the comment
  // above SeedExerciseRecord — a fresh uuid() is generated per row), so
  // `name` (English, effectively unique among the global/seeded rows) is the
  // only reliable join key back to the JSON for a DB that was already seeded
  // before nameEs existed. Never delete+reinsert to "reseed" — RoutineExercise
  // / WorkoutSessionExercise hold FK references to Exercise.id, and since IDs
  // are regenerated on every insert, that would silently orphan any routine
  // or workout session a real user already created against the old rows.
  let backfilled = 0;
  let alreadyPresent = 0;
  for (const record of records) {
    const result = await prisma.exercise.updateMany({
      where: { userId: null, name: record.name, nameEs: null },
      data: { nameEs: record.name_es },
    });
    if (result.count > 0) {
      backfilled += result.count;
    } else {
      alreadyPresent += 1;
    }
  }
  console.log(
    `Exercise nameEs backfill: ${backfilled} rows updated, ${alreadyPresent} already had nameEs`,
  );
  return backfilled;
}

async function seedExercises() {
  // Idempotent: these are immutable global seed rows (userId: null), so
  // there's no need to re-upsert 1,324 records on every `pnpm db:seed` run —
  // just insert once.
  const existingGlobalCount = await prisma.exercise.count({
    where: { userId: null },
  });

  // Read explicitly at runtime via fs.readFileSync + JSON.parse (NOT a
  // TS/ESM JSON import) — this is a 15MB file, no reason to bundle it.
  const raw = fs.readFileSync(EXERCISES_JSON_PATH, 'utf-8');
  const records: SeedExerciseRecord[] = JSON.parse(raw);

  if (existingGlobalCount > 0) {
    console.log(
      `Skipping exercise catalog seed: ${existingGlobalCount} global exercises already present`,
    );
    await backfillExerciseNameEs(records);
    return existingGlobalCount;
  }

  const data = records.map((record) => ({
    userId: null,
    name: record.name,
    nameEs: record.name_es,
    category: record.category,
    bodyPart: record.body_part,
    equipment: record.equipment,
    target: record.target,
    muscleGroup: record.muscle_group,
    secondaryMuscles: record.secondary_muscles,
    instructions: record.instructions,
    image: record.image,
    gifUrl: record.gif_url,
    attribution: record.attribution,
  }));

  // Bulk insert via createMany (NOT a loop of individual create calls —
  // far too slow for 1,324 rows).
  await prisma.exercise.createMany({ data, skipDuplicates: true });

  return data.length;
}

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

  // Global defaults (userId: null), visible to every user — not per-user
  // rows anymore. The partial unique index
  // categories_name_movement_type_global_unique enforces uniqueness among
  // them, but Prisma's schema-level @@unique([name, movementType, userId])
  // has no typed accessor for a null userId, so this upserts by hand
  // (find-then-create/skip) instead of prisma.category.upsert().
  for (const category of DEFAULT_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: {
        name: category.name,
        movementType: category.movementType,
        userId: null,
      },
    });
    if (existing) continue;

    await prisma.category.create({
      data: {
        name: category.name,
        icon: category.icon,
        movementType: category.movementType,
        userId: null,
      },
    });
  }

  const exerciseCount = await seedExercises();

  console.log(
    `Seed completed: user "${user.email}" with ${DEFAULT_CATEGORIES.length} categories and ${exerciseCount} global exercises`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
