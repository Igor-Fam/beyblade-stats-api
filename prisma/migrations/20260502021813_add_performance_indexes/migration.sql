-- CreateIndex
CREATE INDEX "battle_entries_battle_id_idx" ON "battle_entries"("battle_id");

-- CreateIndex
CREATE INDEX "battle_entries_line_id_idx" ON "battle_entries"("line_id");

-- CreateIndex
CREATE INDEX "battle_entries_combo_hash_idx" ON "battle_entries"("combo_hash");

-- CreateIndex
CREATE INDEX "battle_entry_parts_part_id_idx" ON "battle_entry_parts"("part_id");

-- CreateIndex
CREATE INDEX "battles_stadium_id_idx" ON "battles"("stadium_id");

-- CreateIndex
CREATE INDEX "parts_part_type_id_idx" ON "parts"("part_type_id");

-- CreateIndex
CREATE INDEX "parts_line_id_idx" ON "parts"("line_id");
