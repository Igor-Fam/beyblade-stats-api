/**
 * ColleyCalculator
 *
 * Implements the Colley Matrix Method for ranking parts based on battle history.
 * This method is completely order-independent — the result is always the same
 * regardless of the sequence in which battles occurred, making it compatible
 * with the import/export multi-database model.
 *
 * Each part starts with a prior of 0.5 (neutral) and is adjusted based on
 * wins, losses, and the strength of the opponents faced.
 *
 * Finish-type weights are applied to the result vector (b) to reflect
 * that dominant victories (Xtreme) are worth more than narrow ones (Spin).
 */

export interface ColleyBattle {
    winnerPartIds: number[];
    loserPartIds:  number[];
    finishWeight:  number;
}

const DISPLAY_SCALE = 1000;

export class ColleyCalculator {

    private static readonly FINISH_WEIGHTS: Record<string, number> = {
        SPIN:   1.0,
        OVER:   1.8,
        BURST:  1.8,
        XTREME: 2.5,
    };

    // Maps a finish type string to its weight multiplier.
    public static getFinishWeight(finishType: string): number {
        return this.FINISH_WEIGHTS[finishType] ?? 1.0;
    }

    /**
     * Main entry point. Builds the Colley system, solves it, and returns
     * a map of partId → display rating (0–1000 scale).
     * Parts that never appeared in any battle are not included in the map
     * and should fall back to a neutral display value of 500.
     */
    public static calculate(partIds: number[], battles: ColleyBattle[]): Map<number, number> {
        const ratings = new Map<number, number>();

        if (partIds.length === 0) return ratings;

        const { C, b } = this.buildSystem(partIds, battles);
        const r = this.solve(C, b);

        partIds.forEach((id, i) => {
            ratings.set(id, Math.round(r[i] * DISPLAY_SCALE));
        });

        return ratings;
    }

    /**
     * Builds the Colley matrix C and result vector b.
     *
     * For each part i:
     *   C[i][i]  = 2 + total_battles[i]
     *   C[i][j]  = -confrontations_between_i_and_j  (for j ≠ i)
     *   b[i]     = 1 + Σ(finish_weight for win) / 2 - Σ(finish_weight for loss) / 2
     *
     * Using full credit (1.0) per part — no fractional credit — to avoid
     * systematic bias against combos from lines with more parts (e.g. CX vs BX).
     */
    private static buildSystem(partIds: number[], battles: ColleyBattle[]): { C: number[][], b: number[] } {
        const p = partIds.length;
        const idx = new Map(partIds.map((id, i) => [id, i]));

        // Initialise C and b
        const C: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
        const b: number[]   = Array(p).fill(1); // prior = 1 (encodes 0.5 neutral rating)

        for (const battle of battles) {
            const w = battle.finishWeight;

            for (const winnerId of battle.winnerPartIds) {
                const wi = idx.get(winnerId);
                if (wi === undefined) continue;

                // Diagonal: total battles played by this part
                C[wi][wi] += 1;
                // Result: weighted win contribution
                b[wi] += w / 2;

                // Cross-terms: reduce rating coupling with each opponent
                for (const loserId of battle.loserPartIds) {
                    const li = idx.get(loserId);
                    if (li === undefined) continue;
                    C[wi][li] -= 1;
                }
            }

            for (const loserId of battle.loserPartIds) {
                const li = idx.get(loserId);
                if (li === undefined) continue;

                C[li][li] += 1;
                b[li] -= w / 2;

                for (const winnerId of battle.winnerPartIds) {
                    const wi = idx.get(winnerId);
                    if (wi === undefined) continue;
                    C[li][wi] -= 1;
                }
            }
        }

        // Add the Colley prior (+2) to every diagonal
        for (let i = 0; i < p; i++) {
            C[i][i] += 2;
        }

        return { C, b };
    }

    /**
     * Solves the linear system C·r = b using Gaussian elimination with
     * partial pivoting. Returns the rating vector r.
     */
    private static solve(C: number[][], b: number[]): number[] {
        const p = C.length;

        // Augmented matrix [C | b]
        const M = C.map((row, i) => [...row, b[i]]);

        for (let col = 0; col < p; col++) {
            // Partial pivoting: find the row with the largest absolute value in this column
            let maxRow = col;
            for (let row = col + 1; row < p; row++) {
                if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) {
                    maxRow = row;
                }
            }
            [M[col], M[maxRow]] = [M[maxRow], M[col]];

            const pivot = M[col][col];
            if (Math.abs(pivot) < 1e-10) continue; // Singular — skip

            // Eliminate column entries below (and above) the pivot
            for (let row = 0; row < p; row++) {
                if (row === col) continue;
                const factor = M[row][col] / pivot;
                for (let k = col; k <= p; k++) {
                    M[row][k] -= factor * M[col][k];
                }
            }
        }

        // Back-substitution: each diagonal holds the solution
        return M.map((row, i) => row[p] / row[i]);
    }
}
