-- Retires the global (userId: null) category concept introduced by
-- 20260713172727_make_category_ownership_optional — every category is a
-- user-owned row from here on (see openspec/changes/add-default-user-template).
--
-- PRODUCTION GATE (manual, do not automate): this migration MUST NOT be
-- applied to production via `prisma migrate deploy` until
-- prisma/scripts/provision-default-user-data.ts has run against production
-- AND its companion verification step confirms zero `userId: null` category
-- rows and zero Movement rows referencing an absent/global category. This
-- ALTER COLUMN ... SET NOT NULL step fails outright if any NULL "user_id"
-- rows still exist — that failure is the intended safety net, not a bug.
--
-- AlterTable
ALTER TABLE "categories" ALTER COLUMN "user_id" SET NOT NULL;

-- The partial unique index that only existed to keep global (userId: null)
-- category rows unique among themselves (see the migration above) has no
-- purpose once "user_id" can never be NULL — the existing compound
-- @@unique([name, movementType, userId]) index already fully enforces
-- per-user uniqueness on its own.
DROP INDEX "categories_name_movement_type_global_unique";

-- Down migration (manual — Prisma does not generate rollback SQL
-- automatically): to reverse this migration, run:
--   ALTER TABLE "categories" ALTER COLUMN "user_id" DROP NOT NULL;
--   CREATE UNIQUE INDEX "categories_name_movement_type_global_unique" ON "categories"("name", "movement_type") WHERE "user_id" IS NULL;
-- This is safe — no row loses data. Do NOT reintroduce userId:null rows
-- afterward; the down path exists purely to unblock a schema rollback.
