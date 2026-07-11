-- icon is required going forward (no @default in schema.prisma), but the 26
-- existing rows need a value to satisfy NOT NULL. Add with a temporary
-- default, backfill implicitly via the default itself, then drop the
-- default so future INSERTs must supply icon explicitly (mirrors the
-- account_is_principal migration's shape for the same reason).
ALTER TABLE "categories" ADD COLUMN "icon" TEXT NOT NULL DEFAULT '🏷️';
ALTER TABLE "categories" ALTER COLUMN "icon" DROP DEFAULT;
