/*
  Warnings:

  - You are about to drop the column `contentType` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `size` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `File` table. All the data in the column will be lost.
  - Added the required column `key` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."File" DROP CONSTRAINT "File_groupId_fkey";

-- AlterTable
ALTER TABLE "public"."File" DROP COLUMN "contentType",
DROP COLUMN "size",
DROP COLUMN "updatedAt",
ADD COLUMN     "key" TEXT NOT NULL,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "sizeBytes" INTEGER,
ALTER COLUMN "uploadedBy" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."FileAccessLog" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileAccessLog_fileId_createdAt_idx" ON "public"."FileAccessLog"("fileId", "createdAt");

-- CreateIndex
CREATE INDEX "File_groupId_createdAt_idx" ON "public"."File"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "File_key_idx" ON "public"."File"("key");

-- AddForeignKey
ALTER TABLE "public"."File" ADD CONSTRAINT "File_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FileAccessLog" ADD CONSTRAINT "FileAccessLog_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "public"."File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
