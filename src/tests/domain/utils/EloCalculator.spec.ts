import { EloCalculator } from '../../../domain/utils/EloCalculator';

describe('EloCalculator', () => {
    describe('calculateExpectedScore', () => {
        it('should return 0.5 for equal ratings', () => {
            const expected = EloCalculator.calculateExpectedScore(1000, 1000);
            expect(expected).toBe(0.5);
        });

        it('should return > 0.5 for a stronger entity', () => {
            const expected = EloCalculator.calculateExpectedScore(1200, 1000);
            expect(expected).toBeGreaterThan(0.5);
        });

        it('should return < 0.5 for a weaker entity', () => {
            const expected = EloCalculator.calculateExpectedScore(800, 1000);
            expect(expected).toBeLessThan(0.5);
        });
    });

    describe('calculateRatingChange', () => {
        it('should return 0 for a draw (if we implemented draws, but here we use win/loss)', () => {
            // If expected is 0.5 and actual is 0.5 (not possible in our binary win/loss)
            const change = EloCalculator.calculateRatingChange(0.5, 0.5, 1);
            expect(change).toBe(0);
        });

        it('should return a positive value for a win', () => {
            const change = EloCalculator.calculateRatingChange(1, 0.5, 1);
            expect(change).toBeGreaterThan(0);
        });

        it('should return a negative value for a loss', () => {
            const change = EloCalculator.calculateRatingChange(0, 0.5, 1);
            expect(change).toBeLessThan(0);
        });

        it('should return a larger positive change for an upset win', () => {
            const smallExpectation = 0.1; // Expected to lose
            const largeExpectation = 0.9; // Expected to win

            const upsetChange = EloCalculator.calculateRatingChange(1, smallExpectation, 1);
            const expectedChange = EloCalculator.calculateRatingChange(1, largeExpectation, 1);

            expect(upsetChange).toBeGreaterThan(expectedChange);
        });
    });

    describe('calculateAverageRating', () => {
        it('should return the correct average', () => {
            const avg = EloCalculator.calculateAverageRating([1000, 1200, 800]);
            expect(avg).toBe(1000);
        });

        it('should return 1000 for an empty list', () => {
            const avg = EloCalculator.calculateAverageRating([]);
            expect(avg).toBe(1000);
        });
    });
});
