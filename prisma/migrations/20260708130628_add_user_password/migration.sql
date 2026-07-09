-- AlterTable
-- Added as nullable first, backfilled with an empty-string placeholder for
-- pre-existing rows (stale e2e test users from before hand-rolled JWT auth
-- existed — nothing legitimately signs in as them), then made NOT NULL.
-- `prisma migrate dev` refuses to run non-interactively against a table with
-- existing rows for a new required column with no default, so this migration
-- was hand-written and applied via `prisma migrate deploy` instead, matching
-- the workaround already used in
-- prisma/migrations/20260708124531_remove_better_auth_tables/.
ALTER TABLE "users" ADD COLUMN "password" TEXT;

UPDATE "users" SET "password" = '' WHERE "password" IS NULL;

ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL;
