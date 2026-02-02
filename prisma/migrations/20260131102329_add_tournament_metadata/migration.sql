-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "location" TEXT,
ADD COLUMN     "roundsJson" JSONB,
ADD COLUMN     "rulesUrl" TEXT,
ADD COLUMN     "scheduleJson" JSONB,
ADD COLUMN     "startDate" TIMESTAMP(3);
