-- AlterTable
ALTER TABLE "public"."guests" ADD COLUMN     "partner_first_name" TEXT,
ADD COLUMN     "partner_last_name" TEXT,
ADD COLUMN     "reserved_seats" INTEGER,
ADD COLUMN     "rsvpd_count" INTEGER;
