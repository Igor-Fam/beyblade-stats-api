import { StatsService } from '../../services/StatsService';
import { prisma } from '../../database';

// Mocking Prisma
jest.mock('../../database', () => ({
    prisma: {
        part: {
            findMany: jest.fn(),
        },
        battle: {
            findMany: jest.fn(),
        },
    },
}));

describe('StatsService (Batch Elo - Unit Test with Mocks)', () => {
    let statsService: StatsService;

    beforeAll(() => {
        statsService = new StatsService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should calculate accurate batch Elo for mocked history', async () => {
        (prisma.part.findMany as jest.Mock).mockResolvedValue([
            { id: 1, name: 'Dran Sword', partType: { name: 'Blade' }, battleEntries: [] },
            { id: 2, name: 'Hell Scythe', partType: { name: 'Blade' }, battleEntries: [] },
        ]);

        //    Battle 1 (SPIN, multiplier 1.0): Part 1 wins.
        //    Both start at 1000 → expected = 0.5
        //    change = round(32 * 1.0 * 0.5) = 16
        //    Part 1: 1000 + 16 = 1016 | Part 2: 1000 - 16 = 984
        (prisma.battle.findMany as jest.Mock).mockResolvedValue([
            {
                id: 1,
                createdAt: new Date('2024-01-01'),
                entries: [
                    { finishType: 'SPIN', points: 1, parts: [{ partId: 1 }] },
                    { finishType: 'SPIN', points: -1, parts: [{ partId: 2 }] },
                ],
            },
        ]);

        // Execution
        const stats = await statsService.getPartsList();
        const statsA = stats.find(p => p.id === 1);
        const statsB = stats.find(p => p.id === 2);

        // Assertions
        expect(statsA?.elo).toBe(1016);
        expect(statsB?.elo).toBe(984);
    });

    it('should correctly process multiple battles and multipliers', async () => {
        (prisma.part.findMany as jest.Mock).mockResolvedValue([
            { id: 1, name: 'Dran Sword', partType: { name: 'Blade' }, battleEntries: [] },
            { id: 2, name: 'Hell Scythe', partType: { name: 'Blade' }, battleEntries: [] },
        ]);

        // Battle 1 (SPIN, multiplier 1.0): Part 1 wins → Part 1: 1016, Part 2: 984
        // Battle 2 (XTREME, multiplier 2.5): Part 1 wins again.
        //   avgRating0 = 1016, avgRating1 = 984
        //   expected0 = 1 / (1 + 10^((984-1016)/400)) ≈ 0.54597
        //   change0 = round(32 * 2.5 * (1 - 0.54597)) = round(36.32) = 36
        //   Part 1: 1016 + 36 = 1052
        (prisma.battle.findMany as jest.Mock).mockResolvedValue([
            {
                id: 1,
                createdAt: new Date('2024-01-01'),
                entries: [
                    { finishType: 'SPIN', points: 1, parts: [{ partId: 1 }] },
                    { finishType: 'SPIN', points: -1, parts: [{ partId: 2 }] },
                ],
            },
            {
                id: 2,
                createdAt: new Date('2024-01-02'),
                entries: [
                    { finishType: 'XTREME', points: 3, parts: [{ partId: 1 }] },
                    { finishType: 'XTREME', points: -3, parts: [{ partId: 2 }] },
                ],
            },
        ]);

        const stats = await statsService.getPartsList();
        const statsA = stats.find(p => p.id === 1);

        expect(statsA?.elo).toBe(1052);
    });
});
