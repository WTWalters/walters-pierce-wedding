-- CreateEnum
CREATE TYPE "public"."WeddingPartySide" AS ENUM ('bride', 'groom');

-- CreateEnum
CREATE TYPE "public"."WeddingPartyRole" AS ENUM ('maid_of_honor', 'bridesmaid', 'best_man', 'groomsman', 'flower_girl', 'ring_bearer');

-- AlterTable
ALTER TABLE "public"."email_logs" ADD COLUMN     "bounced_at" TIMESTAMP(3),
ADD COLUMN     "resend_message_id" TEXT;

-- AlterTable
ALTER TABLE "public"."guests" ADD COLUMN     "party_size" INTEGER,
ADD COLUMN     "song_request" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'imported';

-- CreateTable
CREATE TABLE "public"."wedding_party" (
    "id" UUID NOT NULL,
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

-- CreateIndex
CREATE INDEX "idx_wedding_party_role" ON "public"."wedding_party"("role");

-- CreateIndex
CREATE INDEX "idx_wedding_party_side" ON "public"."wedding_party"("side");

-- CreateIndex
CREATE INDEX "idx_wedding_party_sort" ON "public"."wedding_party"("sort_order");
