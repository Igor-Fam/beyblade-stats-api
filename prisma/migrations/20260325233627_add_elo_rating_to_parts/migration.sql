-- AlterTable
ALTER TABLE "battles" ADD COLUMN     "stadium_id" INTEGER;

-- AlterTable
ALTER TABLE "lines" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "parts" ADD COLUMN     "elo_rating" INTEGER NOT NULL DEFAULT 1000;

-- CreateTable
CREATE TABLE "stadiums" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "stadiums_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stadiums_name_key" ON "stadiums"("name");

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_stadium_id_fkey" FOREIGN KEY ("stadium_id") REFERENCES "stadiums"("id") ON DELETE SET NULL ON UPDATE CASCADE;
