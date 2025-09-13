-- CreateEnum
CREATE TYPE "public"."FileStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "public"."File" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedBy" TEXT,
ADD COLUMN     "status" "public"."FileStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "File_status_groupId_idx" ON "public"."File"("status", "groupId");
