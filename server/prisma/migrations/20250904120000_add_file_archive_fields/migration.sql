-- Add status + archive audit fields to File
-- Existing rows default to ACTIVE

ALTER TYPE "FileStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED'; -- In case enum already exists (fresh deploy will create new enum)

-- If enum doesn't exist yet (fresh migration), create it then add column references
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FileStatus') THEN
        CREATE TYPE "FileStatus" AS ENUM ('ACTIVE','ARCHIVED');
    END IF;
END $$;

ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "status" "FileStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ(6);
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "archivedBy" TEXT;

-- Backfill existing NULLs explicitly (should all be default already)
UPDATE "File" SET "status"='ACTIVE' WHERE "status" IS NULL;

-- New composite index for status, groupId
CREATE INDEX IF NOT EXISTS "File_status_groupId_idx" ON "File" ("status", "groupId");
