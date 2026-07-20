import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/infrastructure/config/database/generated/prisma/client.js';
import { DEFAULT_ACCOUNTS } from '../../src/modules/money-manager/account/domain/default-accounts.js';
import { DEFAULT_CATEGORIES } from '../../src/modules/money-manager/category/domain/default-categories.js';
import { DEFAULT_GROUPS } from '../../src/modules/money-manager/group/domain/default-groups.js';

// Idempotent, re-runnable backfill for EXISTING users created before this
// feature existed (see openspec/changes/add-default-user-template/design.md
// — "Staged rollout: data first, schema last"). New users are already
// provisioned at sign-up by DefaultUserDataProvisioner; this script is only
// for the one-off migration of pre-existing rows plus reassignment/cleanup
// of the retired global (`userId: null`) category rows. Never targets
// production directly from this codebase — invoked manually as
// `DATABASE_URL=<prod> npx tsx prisma/scripts/provision-default-user-data.ts`
// per an operator's own deliberate action, never from app code or CI.

export type ProvisionDefaultUserDataOptions = {
  userIds: string[];
};

export type ProvisionDefaultUserDataReport = {
  usersProcessed: number;
  globalCategoriesDeleted: number;
};

export type CategoryBackfillVerification = {
  nullUserIdCategoryCount: number;
  orphanedMovementCount: number;
};

type GlobalCategoryRow = {
  id: string;
  name: string;
  icon: string;
  movementType: string;
};

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

// Accounts have no compound unique constraint (unlike Category/Group below),
// so idempotency here is a plain find-then-create on the natural key
// (name, userId) rather than a real prisma.account.upsert().
async function provisionDefaultAccounts(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  for (const account of DEFAULT_ACCOUNTS) {
    const existing = await prisma.account.findFirst({
      where: { userId, name: account.name },
    });
    if (existing) {
      continue;
    }
    try {
      await prisma.account.create({
        data: {
          name: account.name,
          type: account.type,
          userId,
          isActive: true,
          isPrincipal: account.isPrincipal,
        },
      });
    } catch (error) {
      // Mirrors PrismaAccountRepository.save()'s P2002 catch-and-retry: an
      // EXISTING user backfilled here may already own an isPrincipal:true
      // account created before this feature existed (or via userB's own
      // manual account in this test), which would otherwise violate the
      // accounts_user_id_principal_unique partial index. Retry as
      // non-principal rather than failing the whole backfill for that user.
      if (account.isPrincipal && isUniqueConstraintViolation(error)) {
        await prisma.account.create({
          data: {
            name: account.name,
            type: account.type,
            userId,
            isActive: true,
            isPrincipal: false,
          },
        });
      } else {
        throw error;
      }
    }
  }
}

// Category has @@unique([name, movementType, userId]) — real upsert, same
// pattern as prisma/seed.ts.
async function provisionDefaultCategories(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  for (const category of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: {
        name_movementType_userId: {
          name: category.name,
          movementType: category.movementType,
          userId,
        },
      },
      update: {},
      create: {
        name: category.name,
        icon: category.icon,
        movementType: category.movementType,
        userId,
        isActive: true,
      },
    });
  }
}

// Group has @@unique([name, userId]) — real upsert.
async function provisionDefaultGroups(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  for (const group of DEFAULT_GROUPS) {
    await prisma.group.upsert({
      where: { name_userId: { name: group.name, userId } },
      update: {},
      create: { name: group.name, userId, isActive: true },
    });
  }
}

// Category.userId is required (NOT NULL) in the Prisma schema/generated
// client TYPES already, ahead of the actual NOT NULL migration being
// deployed (see design.md's staged rollout) — so a still-existing legacy
// global row (userId: null) can no longer be expressed as `{ userId: null }`
// in a typed `where` input. $queryRaw is the only way left to find them.
async function reassignGlobalCategoryMovements(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  const globalRows = await prisma.$queryRaw<GlobalCategoryRow[]>`
    SELECT DISTINCT c.id, c.name, c.icon, c.movement_type AS "movementType"
    FROM categories c
    INNER JOIN movements m ON m.category_id = c.id
    WHERE c.user_id IS NULL AND m.user_id = ${userId}
  `;

  for (const globalRow of globalRows) {
    let ownedCategory = await prisma.category.findUnique({
      where: {
        name_movementType_userId: {
          name: globalRow.name,
          movementType: globalRow.movementType,
          userId,
        },
      },
    });

    // Not among the 15 DEFAULT_CATEGORIES (or not yet provisioned for this
    // user) — create an owned copy reusing the global row's OWN icon
    // verbatim, never a placeholder and never an unrelated default's icon.
    if (!ownedCategory) {
      ownedCategory = await prisma.category.create({
        data: {
          name: globalRow.name,
          icon: globalRow.icon,
          movementType: globalRow.movementType,
          userId,
          isActive: true,
        },
      });
    }

    await prisma.movement.updateMany({
      where: { userId, categoryId: globalRow.id },
      data: { categoryId: ownedCategory.id },
    });
  }
}

// Runs once per invocation (not per user) — deletes every global category
// left with zero referencing movements, regardless of which users were in
// scope for this call. Raw SQL for the same "userId: null" typing reason as
// reassignGlobalCategoryMovements above.
async function deleteUnreferencedGlobalCategories(
  prisma: PrismaClient,
): Promise<number> {
  return prisma.$executeRaw`
    DELETE FROM categories c
    WHERE c.user_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM movements m WHERE m.category_id = c.id
      )
  `;
}

export async function provisionDefaultUserData(
  prisma: PrismaClient,
  options: ProvisionDefaultUserDataOptions,
): Promise<ProvisionDefaultUserDataReport> {
  for (const userId of options.userIds) {
    await provisionDefaultAccounts(prisma, userId);
    await provisionDefaultCategories(prisma, userId);
    await provisionDefaultGroups(prisma, userId);
    await reassignGlobalCategoryMovements(prisma, userId);
  }

  const globalCategoriesDeleted =
    await deleteUnreferencedGlobalCategories(prisma);

  return {
    usersProcessed: options.userIds.length,
    globalCategoriesDeleted,
  };
}

// Read-only verification gate — Phase 5's NOT NULL migration must only be
// deployed once both counts are 0 (see design.md's "Verify" rollout step).
export async function verifyCategoryBackfillComplete(
  prisma: PrismaClient,
): Promise<CategoryBackfillVerification> {
  const [{ count: rawNullUserIdCount }] = await prisma.$queryRaw<
    { count: bigint }[]
  >`SELECT count(*) AS count FROM categories WHERE user_id IS NULL`;

  // Defensive regression guard, not something this backfill is expected to
  // ever need to fix: Movement.category is onDelete: Restrict, so a
  // Movement referencing an absent category is structurally impossible.
  const [{ count: rawOrphanedMovementCount }] = await prisma.$queryRaw<
    { count: bigint }[]
  >`
    SELECT count(*) AS count
    FROM movements m
    LEFT JOIN categories c ON c.id = m.category_id
    WHERE c.id IS NULL
  `;

  return {
    nullUserIdCategoryCount: Number(rawNullUserIdCount),
    orphanedMovementCount: Number(rawOrphanedMovementCount),
  };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const users = await prisma.user.findMany({ select: { id: true } });
    const report = await provisionDefaultUserData(prisma, {
      userIds: users.map((user) => user.id),
    });
    const verification = await verifyCategoryBackfillComplete(prisma);

    console.log(
      `Backfill complete: ${report.usersProcessed} users processed, ` +
        `${report.globalCategoriesDeleted} unreferenced global categories deleted.`,
    );
    console.log(
      `Verification: ${verification.nullUserIdCategoryCount} categories with a ` +
        `null userId remain, ${verification.orphanedMovementCount} movements ` +
        `reference a missing category.`,
    );

    if (
      verification.nullUserIdCategoryCount > 0 ||
      verification.orphanedMovementCount > 0
    ) {
      throw new Error(
        'Backfill verification failed — do NOT proceed to the Category.userId NOT NULL migration.',
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Guarded so importing this module (e.g. from the e2e spec) never triggers
// a real run against whatever DATABASE_URL happens to be set — only running
// this file directly does.
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
