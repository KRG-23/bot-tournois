/*
  Warnings:

  - Added the required column `updatedAt` to the `Pairing` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PairResult" AS ENUM ('WIN', 'LOSS', 'DRAW');

-- AlterTable
ALTER TABLE "Pairing" ADD COLUMN     "resultA" "PairResult",
ADD COLUMN     "resultB" "PairResult",
ADD COLUMN     "scoreA" INTEGER,
ADD COLUMN     "scoreB" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false;
