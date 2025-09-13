/*
  Warnings:

  - You are about to drop the column `endsOn` on the `Group` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[storagePrefix]` on the table `Group` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Group" DROP COLUMN "endsOn",
ADD COLUMN     "slug" VARCHAR(50);

-- CreateIndex
CREATE UNIQUE INDEX "Group_storagePrefix_key" ON "public"."Group"("storagePrefix");

-- CreateIndex
CREATE INDEX "Group_name_idx" ON "public"."Group"("name");

-- CreateIndex
CREATE INDEX "Group_slug_idx" ON "public"."Group"("slug");
