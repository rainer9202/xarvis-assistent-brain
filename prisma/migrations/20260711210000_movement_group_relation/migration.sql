-- AlterTable: groupId is optional — a movement doesn't have to belong to a
-- group, so no backfill needed for existing rows (they stay NULL).
ALTER TABLE "movements" ADD COLUMN "group_id" TEXT;

-- CreateIndex
CREATE INDEX "movements_group_id_idx" ON "movements"("group_id");

-- AddForeignKey
-- ON DELETE SET NULL: deleting a Group orphans its movements (groupId ->
-- NULL) instead of cascading or being blocked — Group is a lightweight
-- organizational tag, not a hard dependency, so DeleteGroupUseCase needs no
-- reference guard.
ALTER TABLE "movements" ADD CONSTRAINT "movements_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
