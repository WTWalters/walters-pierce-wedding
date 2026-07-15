-- Make guest email optional (postal-only invites have no email address).
-- The unique index remains; Postgres allows multiple NULLs under a UNIQUE index.
ALTER TABLE "guests" ALTER COLUMN "email" DROP NOT NULL;
