-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "discordId" TEXT;

-- CreateIndex
CREATE INDEX "Player_discordId_idx" ON "Player"("discordId");
