-- CreateTable
CREATE TABLE "body_metrics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "weight_grams" INTEGER NOT NULL,
    "height_cm" INTEGER NOT NULL,
    "measured_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "body_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "body_metrics_user_id_idx" ON "body_metrics"("user_id");

-- AddForeignKey
ALTER TABLE "body_metrics" ADD CONSTRAINT "body_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
