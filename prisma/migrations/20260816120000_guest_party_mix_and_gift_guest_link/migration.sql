-- Who an RSVP'd party is made of. Nullable on purpose: an existing party that
-- Nicolle hasn't broken out yet is "unknown", not "zero adults".
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "adults" INTEGER;
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "children" INTEGER;

-- The guest a gift came from, when it was picked on the gift form. Nullable: every
-- Stripe gift and every gift recorded before this column existed has none, and those
-- fall back to name/email matching.
ALTER TABLE "contributions" ADD COLUMN IF NOT EXISTS "guest_id" UUID;

-- ON DELETE SET NULL: removing a guest must not delete the record of their gift.
DO $$
BEGIN
  ALTER TABLE "contributions"
    ADD CONSTRAINT "contributions_guest_id_fkey"
    FOREIGN KEY ("guest_id") REFERENCES "guests"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Thank-you sending looks gifts up by guest, so the FK gets an index.
CREATE INDEX IF NOT EXISTS "contributions_guest_id_idx" ON "contributions"("guest_id");
