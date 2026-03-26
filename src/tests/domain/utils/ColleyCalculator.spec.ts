import { ColleyCalculator, ColleyBattle } from '../../../domain/utils/ColleyCalculator';

const NEUTRAL = 500;

describe('ColleyCalculator', () => {

    describe('getFinishWeight', () => {
        it('should return 1.0 for SPIN', () => {
            expect(ColleyCalculator.getFinishWeight('SPIN')).toBe(1.0);
        });

        it('should return 1.8 for OVER and BURST', () => {
            expect(ColleyCalculator.getFinishWeight('OVER')).toBe(1.8);
            expect(ColleyCalculator.getFinishWeight('BURST')).toBe(1.8);
        });

        it('should return 2.5 for XTREME', () => {
            expect(ColleyCalculator.getFinishWeight('XTREME')).toBe(2.5);
        });

        it('should return 1.0 for unknown finish types', () => {
            expect(ColleyCalculator.getFinishWeight('UNKNOWN')).toBe(1.0);
        });
    });

    describe('calculate', () => {
        it('should return an empty map for an empty parts list', () => {
            const result = ColleyCalculator.calculate([], []);
            expect(result.size).toBe(0);
        });

        it('should return the neutral rating (500) for a part with no battles', () => {
            // Part 99 exists in the catalog but has never fought
            const result = ColleyCalculator.calculate([99], []);
            // With no battles, the system collapses to b[0]=1, C[0][0]=2 → r=0.5 → display=500
            expect(result.get(99)).toBe(NEUTRAL);
        });

        it('winner should be rated higher than loser after one battle', () => {
            const battles: ColleyBattle[] = [
                { winnerPartIds: [1], loserPartIds: [2], finishWeight: 1.0 }
            ];
            const result = ColleyCalculator.calculate([1, 2], battles);

            expect(result.get(1)).toBeGreaterThan(NEUTRAL);
            expect(result.get(2)).toBeLessThan(NEUTRAL);
        });

        it('should produce symmetric ratings for perfectly balanced opponents', () => {
            // 2 battles: A beats B once, B beats A once
            const battles: ColleyBattle[] = [
                { winnerPartIds: [1], loserPartIds: [2], finishWeight: 1.0 },
                { winnerPartIds: [2], loserPartIds: [1], finishWeight: 1.0 },
            ];
            const result = ColleyCalculator.calculate([1, 2], battles);

            expect(result.get(1)).toBe(result.get(2));
            expect(result.get(1)).toBe(NEUTRAL);
        });

        it('should rate XTREME winners higher than SPIN winners with the same record', () => {
            // Part A beats Part C by SPIN; Part B beats Part D by XTREME
            const battles: ColleyBattle[] = [
                { winnerPartIds: [1], loserPartIds: [3], finishWeight: ColleyCalculator.getFinishWeight('SPIN') },
                { winnerPartIds: [2], loserPartIds: [4], finishWeight: ColleyCalculator.getFinishWeight('XTREME') },
            ];
            const result = ColleyCalculator.calculate([1, 2, 3, 4], battles);

            // B (XTREME winner) > A (SPIN winner)
            expect(result.get(2)).toBeGreaterThan(result.get(1)!);
            // D (XTREME loser) < C (SPIN loser)
            expect(result.get(4)).toBeLessThan(result.get(3)!);
        });

        it('should validate Colley mathematical invariant: ratings sum to number of parts', () => {
            // The sum of all Colley ratings (on 0–1 scale) must equal p/2.
            // On the 0–1000 display scale, the sum must equal p * 500.
            const battles: ColleyBattle[] = [
                { winnerPartIds: [1], loserPartIds: [2], finishWeight: 1.0 },
                { winnerPartIds: [2], loserPartIds: [3], finishWeight: 1.8 },
                { winnerPartIds: [1], loserPartIds: [3], finishWeight: 2.5 },
            ];
            const partIds = [1, 2, 3];
            const result = ColleyCalculator.calculate(partIds, battles);

            const sum = partIds.reduce((acc, id) => acc + (result.get(id) ?? 0), 0);
            // Allow ±1 per part due to Math.round rounding
            expect(sum).toBeCloseTo(partIds.length * NEUTRAL, -1);
        });

        it('should be order-independent: same result regardless of battle sequence', () => {
            const battlesAB: ColleyBattle[] = [
                { winnerPartIds: [1], loserPartIds: [2], finishWeight: 1.0 },
                { winnerPartIds: [1], loserPartIds: [2], finishWeight: 2.5 },
            ];
            const battlesBA: ColleyBattle[] = [
                { winnerPartIds: [1], loserPartIds: [2], finishWeight: 2.5 },
                { winnerPartIds: [1], loserPartIds: [2], finishWeight: 1.0 },
            ];

            const resultAB = ColleyCalculator.calculate([1, 2], battlesAB);
            const resultBA = ColleyCalculator.calculate([1, 2], battlesBA);

            expect(resultAB.get(1)).toBe(resultBA.get(1));
            expect(resultAB.get(2)).toBe(resultBA.get(2));
        });
    });
});
