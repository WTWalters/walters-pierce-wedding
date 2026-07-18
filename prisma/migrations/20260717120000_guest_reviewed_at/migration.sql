-- AlterTable
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "reviewed_by" TEXT;
