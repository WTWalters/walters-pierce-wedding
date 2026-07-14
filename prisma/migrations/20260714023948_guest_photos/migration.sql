-- AlterTable
ALTER TABLE "public"."photo_comments" ADD COLUMN     "is_hidden" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "author_email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."photos" ADD COLUMN     "is_hidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."photo_likes" (
    "id" UUID NOT NULL,
    "photo_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "photo_likes_photo_id_device_id_key" ON "public"."photo_likes"("photo_id", "device_id");

-- AddForeignKey
ALTER TABLE "public"."photo_likes" ADD CONSTRAINT "photo_likes_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
