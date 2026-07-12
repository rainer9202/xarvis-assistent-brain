-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "credit_limit_cents" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "groups" ALTER COLUMN "budget_cents" SET DATA TYPE DECIMAL(14,2);
