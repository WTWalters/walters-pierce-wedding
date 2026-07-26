-- Manual gift records: gifts that arrive as cash, a cheque, or a physical present.
-- Both columns are nullable so existing Stripe contributions are unaffected.
ALTER TABLE "public"."contributions" ADD COLUMN IF NOT EXISTS "gift_description" TEXT;
ALTER TABLE "public"."contributions" ADD COLUMN IF NOT EXISTS "source" TEXT;
