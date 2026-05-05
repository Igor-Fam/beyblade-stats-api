/*
  Warnings:

  - The primary key for the `battles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `database_id` to the `battles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `battles` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "battle_entries" DROP CONSTRAINT "battle_entries_battle_id_fkey";

-- AlterTable
ALTER TABLE "battle_entries" ALTER COLUMN "battle_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "battles" DROP CONSTRAINT "battles_pkey",
ADD COLUMN     "database_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "battles_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "battles_id_seq";

-- CreateTable
CREATE TABLE "databases" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "databases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "databases_owner_id_idx" ON "databases"("owner_id");

-- CreateIndex
CREATE INDEX "battles_database_id_idx" ON "battles"("database_id");

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_database_id_fkey" FOREIGN KEY ("database_id") REFERENCES "databases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_entries" ADD CONSTRAINT "battle_entries_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
