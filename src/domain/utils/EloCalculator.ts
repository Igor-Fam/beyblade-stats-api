/**
 * EloCalculator
 * 
 * Provides static methods for calculating Elo rating updates based on 
 * competition results between two entities (or combos).
 */
export class EloCalculator {
    private static readonly K_FACTOR = 32;

    /**
     * Calculates the expected score for an entity based on its rating and the opponent's rating.
     * @param rating Rating of the current entity.
     * @param opponentRating Rating of the opponent.
     * @returns Expected score (0 to 1).
     */
    public static calculateExpectedScore(rating: number, opponentRating: number): number {
        return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
    }

    /**
     * Calculates the rating change (Δ) based on the actual score and the expected score.
     * @param actualScore 1 for win, 0 for loss.
     * @param expectedScore Calculated expected score.
     * @returns The amount to add/subtract from the current rating.
     */
    public static calculateRatingChange(actualScore: number, expectedScore: number, kMultiplier: number): number {
        return Math.round(this.K_FACTOR * kMultiplier * (actualScore - expectedScore));
    }

    /**
     * Helper to get the average rating of a list of parts (a combo).
     * @param ratings Array of numerical ratings.
     * @returns The mathematical mean.
     */
    public static calculateAverageRating(ratings: number[]): number {
        if (ratings.length === 0) return 1000;
        const sum = ratings.reduce((acc, curr) => acc + curr, 0);
        return sum / ratings.length;
    }
}
