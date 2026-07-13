-- AlterTable
ALTER TABLE "categories" ALTER COLUMN "user_id" DROP NOT NULL;

-- Data migration: every category that exists today becomes a global
-- default (userId: null). This app currently has a single real user, so
-- this makes their existing categories the shared defaults every account
-- sees going forward, per the explicit product decision to retire
-- per-user default-category seeding in favor of one shared set.
UPDATE "categories" SET "user_id" = NULL;

-- Closes the same gap the plain @@unique([name, movementType, userId])
-- constraint leaves open once userId is nullable: Postgres treats every
-- NULL as distinct for uniqueness purposes, so the compound unique index
-- alone would happily allow two different global "Comida"/MT01 rows to
-- coexist. This partial unique index (same technique as
-- accounts_user_id_principal_unique) closes that gap specifically for the
-- userId IS NULL case, while the existing compound index keeps working
-- unchanged for every real per-user category.
CREATE UNIQUE INDEX "categories_name_movement_type_global_unique" ON "categories"("name", "movement_type") WHERE "user_id" IS NULL;
