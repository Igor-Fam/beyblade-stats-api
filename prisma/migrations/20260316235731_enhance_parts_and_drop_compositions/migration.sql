/*
  Warnings:

  - You are about to drop the `line_compositions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "line_compositions" DROP CONSTRAINT "line_compositions_line_id_fkey";

-- DropForeignKey
ALTER TABLE "line_compositions" DROP CONSTRAINT "line_compositions_part_type_id_fkey";

-- AlterTable
ALTER TABLE "parts" ADD COLUMN     "line_id" INTEGER,
ADD COLUMN     "metadata" JSONB;

-- DropTable
DROP TABLE "line_compositions";

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
