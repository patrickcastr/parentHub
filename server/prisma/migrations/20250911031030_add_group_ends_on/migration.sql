-- AlterTable
ALTER TABLE "public"."Group" ADD COLUMN     "endsOn" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "Group_startsOn_idx" ON "public"."Group"("startsOn");

-- CreateIndex
CREATE INDEX "Group_endsOn_idx" ON "public"."Group"("endsOn");
