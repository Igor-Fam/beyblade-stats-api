-- CreateTable
CREATE TABLE "part_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "part_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lines" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line_compositions" (
    "line_id" INTEGER NOT NULL,
    "part_type_id" INTEGER NOT NULL,

    CONSTRAINT "line_compositions_pkey" PRIMARY KEY ("line_id","part_type_id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "part_type_id" INTEGER NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battles" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_entries" (
    "id" SERIAL NOT NULL,
    "battle_id" INTEGER NOT NULL,
    "line_id" INTEGER NOT NULL,
    "finish_type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "combo_hash" TEXT NOT NULL,

    CONSTRAINT "battle_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_entry_parts" (
    "battle_entry_id" INTEGER NOT NULL,
    "part_id" INTEGER NOT NULL,

    CONSTRAINT "battle_entry_parts_pkey" PRIMARY KEY ("battle_entry_id","part_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "part_types_name_key" ON "part_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "lines_name_key" ON "lines"("name");

-- AddForeignKey
ALTER TABLE "line_compositions" ADD CONSTRAINT "line_compositions_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_compositions" ADD CONSTRAINT "line_compositions_part_type_id_fkey" FOREIGN KEY ("part_type_id") REFERENCES "part_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_part_type_id_fkey" FOREIGN KEY ("part_type_id") REFERENCES "part_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_entries" ADD CONSTRAINT "battle_entries_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_entries" ADD CONSTRAINT "battle_entries_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_entry_parts" ADD CONSTRAINT "battle_entry_parts_battle_entry_id_fkey" FOREIGN KEY ("battle_entry_id") REFERENCES "battle_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_entry_parts" ADD CONSTRAINT "battle_entry_parts_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
