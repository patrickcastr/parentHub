/*
  Warnings:

  - Added the required column `storagePrefix` to the `Group` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Group" ADD COLUMN "storagePrefix" TEXT;

-- Backfill existing groups with generated storagePrefix: groups/<id>-<slug>/
UPDATE "public"."Group" SET "storagePrefix" = 'groups/' || "id" || '-' || regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g') || '/'
WHERE "storagePrefix" IS NULL;

-- Make column NOT NULL after backfill
ALTER TABLE "public"."Group" ALTER COLUMN "storagePrefix" SET NOT NULL;
