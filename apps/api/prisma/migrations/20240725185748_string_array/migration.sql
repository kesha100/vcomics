/*
  Warnings:

  - The `text` column on the `Panel` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Panel" DROP COLUMN "text",
ADD COLUMN     "text" TEXT[];
