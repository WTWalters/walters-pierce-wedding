CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "public"."WeddingPartySide" AS ENUM ('bride', 'groom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "public"."WeddingPartyRole" AS ENUM ('maid_of_honor', 'bridesmaid', 'best_man', 'groomsman', 'flower_girl', 'ring_bearer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "public"."email_logs" ADD COLUMN IF NOT EXISTS "bounced_at" TIMESTAMP(3);
ALTER TABLE "public"."email_logs" ADD COLUMN IF NOT EXISTS "resend_message_id" TEXT;

-- AlterTable
ALTER TABLE "public"."guests" ADD COLUMN IF NOT EXISTS "party_size" INTEGER;
ALTER TABLE "public"."guests" ADD COLUMN IF NOT EXISTS "song_request" TEXT;
ALTER TABLE "public"."guests" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'imported';

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "public"."wedding_party" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "role" "public"."WeddingPartyRole" NOT NULL,
    "side" "public"."WeddingPartySide" NOT NULL,
    "bio" TEXT,
    "relationship" VARCHAR(255),
    "photo_url" VARCHAR(500),
    "sort_order" INTEGER DEFAULT 0,
    "is_featured" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wedding_party_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "idx_wedding_party_role" ON "public"."wedding_party"("role");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "idx_wedding_party_side" ON "public"."wedding_party"("side");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "idx_wedding_party_sort" ON "public"."wedding_party"("sort_order");
