import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '@config/database/prisma.service';
import { createTestApp } from '../utils/test-app';
import {
  provisionDefaultUserData,
  verifyCategoryBackfillComplete,
} from '../../prisma/scripts/provision-default-user-data';

// Inserts a "legacy" global (userId: null) category row directly via raw
// SQL — Category.userId is required in the Prisma schema/generated client
// types (see openspec/changes/add-default-user-template's staged rollout:
// schema.prisma was already updated ahead of the NOT NULL migration
// actually being applied), so the typed client can no longer express a
// null userId. Raw SQL is the only way left to simulate the pre-migration
// state this backfill script exists to clean up.
async function insertLegacyGlobalCategory(
  prisma: PrismaService,
  data: { name: string; icon: string; movementType: string },
): Promise<string> {
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO categories (id, name, icon, movement_type, user_id, is_active, created_at, updated_at)
    VALUES (${id}, ${data.name}, ${data.icon}, ${data.movementType}, NULL, true, now(), now())
  `;
  return id;
}

async function createTestUser(prisma: PrismaService, label: string) {
  return prisma.user.create({
    data: {
      name: `Backfill ${label}`,
      email: `backfill-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      password: await argon2.hash('password123'),
    },
  });
}

describe('provision-default-user-data backfill script', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;
  });

  afterAll(async () => {
    await app.close();
  });

  it('provisions defaults, reassigns global-category movements, deletes now-unreferenced globals, and is idempotent', async () => {
    // Scenario A: an existing user with zero accounts/categories/groups.
    const userA = await createTestUser(prisma, 'zero-data');

    // Scenario B: an existing user with a Movement referencing a global
    // DEFAULT category (name+movementType matches one of the 15
    // DEFAULT_CATEGORIES entries — reuses the ALREADY-PRESENT shared
    // "Supermercado"/MT01 global row rather than inserting a duplicate,
    // since the partial unique index `categories_name_movement_type_
    // global_unique` allows only ONE global row per (name, movementType)
    // system-wide, and this repo's local dev DB already has one).
    const userB = await createTestUser(prisma, 'global-default');
    const accountB = await prisma.account.create({
      data: {
        name: 'Cuenta B',
        type: 'AT01',
        userId: userB.id,
        isActive: true,
        isPrincipal: true,
      },
    });
    const [{ id: globalDefaultCategoryId }] = await prisma.$queryRaw<
      { id: string }[]
    >`
      SELECT id FROM categories
      WHERE name = 'Supermercado' AND movement_type = 'MT01' AND user_id IS NULL
      LIMIT 1
    `;
    const movementB = await prisma.movement.create({
      data: {
        amount: 100,
        date: new Date(),
        accountId: accountB.id,
        categoryId: globalDefaultCategoryId,
        movementType: 'MT01',
        userId: userB.id,
      },
    });

    // Scenario C: an existing user with a Movement referencing a global
    // NON-default category (not among the 15 DEFAULT_CATEGORIES) — a fresh,
    // guaranteed-unique global row inserted just for this test, so it is
    // safe to assert it gets deleted once unreferenced (no other user/test
    // in this shared dev DB could possibly reference it).
    const userC = await createTestUser(prisma, 'global-custom');
    const accountC = await prisma.account.create({
      data: {
        name: 'Cuenta C',
        type: 'AT01',
        userId: userC.id,
        isActive: true,
        isPrincipal: true,
      },
    });
    const customCategoryName = `E2E Custom Global ${randomUUID()}`;
    const globalCustomCategoryId = await insertLegacyGlobalCategory(prisma, {
      name: customCategoryName,
      icon: 'star-outline',
      movementType: 'MT01',
    });
    const movementC = await prisma.movement.create({
      data: {
        amount: 50,
        date: new Date(),
        accountId: accountC.id,
        categoryId: globalCustomCategoryId,
        movementType: 'MT01',
        userId: userC.id,
      },
    });

    const scopedUserIds = [userA.id, userB.id, userC.id];

    const report = await provisionDefaultUserData(prisma, {
      userIds: scopedUserIds,
    });

    expect(report.usersProcessed).toBe(3);

    // Scenario A assertions: zero-accounts user ends up with exactly the
    // default set.
    const accountsA = await prisma.account.findMany({
      where: { userId: userA.id },
    });
    expect(accountsA).toHaveLength(3);
    expect(accountsA.find((a) => a.name === 'Principal')?.isPrincipal).toBe(
      true,
    );
    const categoriesA = await prisma.category.findMany({
      where: { userId: userA.id },
    });
    expect(categoriesA).toHaveLength(15);
    const groupsA = await prisma.group.findMany({
      where: { userId: userA.id },
    });
    expect(groupsA).toHaveLength(2);

    // Scenario B assertions: the default-global Movement is reassigned to
    // the user's OWN owned copy of "Supermercado"/MT01 (created as part of
    // this same user's default-category provisioning), not left pointing
    // at the shared global row.
    const ownedDefaultCategoryB = await prisma.category.findFirst({
      where: { userId: userB.id, name: 'Supermercado', movementType: 'MT01' },
    });
    expect(ownedDefaultCategoryB).not.toBeNull();
    expect(ownedDefaultCategoryB!.id).not.toBe(globalDefaultCategoryId);
    const reloadedMovementB = await prisma.movement.findUnique({
      where: { id: movementB.id },
    });
    expect(reloadedMovementB?.categoryId).toBe(ownedDefaultCategoryB!.id);

    // Scenario C assertions: the non-default-global Movement is reassigned
    // to a newly-created owned copy carrying the original global row's
    // icon verbatim, and the now-unreferenced global row is deleted.
    const ownedCustomCategoryC = await prisma.category.findFirst({
      where: {
        userId: userC.id,
        name: customCategoryName,
        movementType: 'MT01',
      },
    });
    expect(ownedCustomCategoryC).not.toBeNull();
    expect(ownedCustomCategoryC!.icon).toBe('star-outline');
    const reloadedMovementC = await prisma.movement.findUnique({
      where: { id: movementC.id },
    });
    expect(reloadedMovementC?.categoryId).toBe(ownedCustomCategoryC!.id);
    const globalCustomStillExists = await prisma.category.findUnique({
      where: { id: globalCustomCategoryId },
    });
    expect(globalCustomStillExists).toBeNull();
    expect(report.globalCategoriesDeleted).toBeGreaterThanOrEqual(1);

    // Idempotency: running the backfill again for the same users must not
    // create any duplicate accounts/categories/groups, and reassignment
    // must remain stable (already-owned rows are reused, not recreated).
    const secondReport = await provisionDefaultUserData(prisma, {
      userIds: scopedUserIds,
    });
    expect(secondReport.usersProcessed).toBe(3);

    const accountsA2 = await prisma.account.findMany({
      where: { userId: userA.id },
    });
    expect(accountsA2).toHaveLength(3);
    const categoriesA2 = await prisma.category.findMany({
      where: { userId: userA.id },
    });
    expect(categoriesA2).toHaveLength(15);
    const groupsA2 = await prisma.group.findMany({
      where: { userId: userA.id },
    });
    expect(groupsA2).toHaveLength(2);

    const ownedDefaultCategoryB2 = await prisma.category.findFirst({
      where: { userId: userB.id, name: 'Supermercado', movementType: 'MT01' },
    });
    expect(ownedDefaultCategoryB2!.id).toBe(ownedDefaultCategoryB!.id);
    const categoriesB2 = await prisma.category.findMany({
      where: { userId: userB.id },
    });
    expect(categoriesB2).toHaveLength(15);
  }, 30_000);

  it('verifyCategoryBackfillComplete detects an unreferenced global category and confirms its removal', async () => {
    const before = await verifyCategoryBackfillComplete(prisma);

    const isolatedCategoryId = await insertLegacyGlobalCategory(prisma, {
      name: `E2E Orphan Global ${randomUUID()}`,
      icon: 'help-outline',
      movementType: 'MT01',
    });
    const afterInsert = await verifyCategoryBackfillComplete(prisma);
    expect(afterInsert.nullUserIdCategoryCount).toBe(
      before.nullUserIdCategoryCount + 1,
    );

    // No movement references it, so the global cleanup pass removes it
    // even with an otherwise-empty user scope.
    await provisionDefaultUserData(prisma, { userIds: [] });

    const afterBackfill = await verifyCategoryBackfillComplete(prisma);
    expect(afterBackfill.nullUserIdCategoryCount).toBe(
      before.nullUserIdCategoryCount,
    );
    const stillExists = await prisma.category.findUnique({
      where: { id: isolatedCategoryId },
    });
    expect(stillExists).toBeNull();

    // The schema's Movement.category onDelete:Restrict FK constraint makes
    // a true orphaned-category-reference structurally impossible — this
    // assertion is a defensive regression guard (see design.md's "Verify:
    // ... no orphan movements"), not a scenario this test needs to
    // engineer by hand.
    expect(afterBackfill.orphanedMovementCount).toBe(0);
  }, 30_000);
});
