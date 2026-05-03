/**
 * ColleyCalculator
 *
 * Implements the Colley Matrix Method for ranking parts based on battle history.
 * This method is completely order-independent: the result is always the same
 * regardless of the sequence in which battles occurred.
 *
 * Each part starts with a prior of 0.5 (neutral) and is adjusted based on
 * wins, losses, and the strength of the opponents faced.
 *
 * Finish-type weights are represented as a number of virtual additional battles.
 * A 1× win SPIN = 1 battle; 1× win XTREME = 3 battles. This preserves the
 * mathematical [0,1] guarantee of the Colley method (unlike direct b-weighting).
 */

export interface ColleyBattle {
    winnerPartIds: number[];
    loserPartIds: number[];
    finishWeight: number;
}

const DISPLAY_SCALE = 1000;

export class ColleyCalculator {

    /**
     * Number of virtual battles each finish type counts as.
     * Integer values preserve the [0,1] mathematical guarantee of the Colley method:
     *   SPIN   → 1  (baseline)
     *   OVER   → 2  (≈1.8 rounded)
     *   BURST  → 2  (≈1.8 rounded)
     *   XTREME → 3  (≈2.5 rounded)
     */
    private static readonly FINISH_WEIGHTS: Record<string, number> = {
        SPIN:   1,
        OVER:   2,
        BURST:  2,
        XTREME: 3,
    };

    // Returns the virtual-battle count for a given finish type (defaults to 1).
    public static getFinishWeight(finishType: string): number {
        return this.FINISH_WEIGHTS[finishType] ?? 1;
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
     *   C[i][i]  = 2 + virtual_battles[i]
     *   C[i][j]  = -virtual_confrontations_between_i_and_j  (for j ≠ i)
     *   b[i]     = 1 + (virtual_wins[i] - virtual_losses[i]) / 2
     *
     * Each real battle is repeated `finishWeight` times (an integer) so that
     * the [0, 1] invariant of the standard Colley method is preserved.
     */
    private static buildSystem(partIds: number[], battles: ColleyBattle[]): { C: number[][], b: number[] } {
        const p = partIds.length;
        const idx = new Map(partIds.map((id, i) => [id, i]));

        const C: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
        const b: number[] = Array(p).fill(1); // prior = 1 (encodes 0.5 neutral rating)

        for (const battle of battles) {
            const n = battle.finishWeight; // integer virtual-battle count

            for (const winnerId of battle.winnerPartIds) {
                const wi = idx.get(winnerId);
                if (wi === undefined) continue;

                for (const loserId of battle.loserPartIds) {
                    const li = idx.get(loserId);
                    if (li === undefined) continue;

                    // One symmetric (winner_i, loser_j) interaction × n virtual battles.
                    // Both diagonals grow equally so C row sums stay 0 (before +2 prior),
                    // preserving the [0, 1] mathematical guarantee for any combo size.
                    C[wi][wi] += n;
                    C[li][li] += n;
                    C[wi][li] -= n;
                    C[li][wi] -= n;
                    b[wi] += n / 2;
                    b[li] -= n / 2;
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
