-- A third bucket in a party's make-up, for the bar: an adult under 21 eats an adult
-- meal but drinks nothing, so they can't be counted in the same number as an adult
-- who does. The existing "adults" column now means 21+; nothing had been entered
-- into it yet, so no backfill is needed.
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "adults_under_21" INTEGER;
