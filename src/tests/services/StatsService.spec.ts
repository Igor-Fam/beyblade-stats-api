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

describe('StatsService (Colley Rating - Unit Test with Mocks)', () => {
    let statsService: StatsService;

    beforeAll(() => {
        statsService = new StatsService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should assign higher rating to the winner after one battle', async () => {
        // Colley with 1 battle (SPIN, weight=1.0): Part 1 wins.
        //   C = [[3,-1],[-1,3]], b = [1.5, 0.5]
        //   r[0] = 0.625 → 625 | r[1] = 0.375 → 375
        (prisma.part.findMany as jest.Mock).mockResolvedValue([
            { id: 1, name: 'Dran Sword',  partType: { name: 'Blade' }, battleEntries: [] },
            { id: 2, name: 'Hell Scythe', partType: { name: 'Blade' }, battleEntries: [] },
        ]);

        (prisma.battle.findMany as jest.Mock).mockResolvedValue([
            {
                id: 1,
                createdAt: new Date('2024-01-01'),
                entries: [
                    { finishType: 'SPIN', points:  1, parts: [{ partId: 1 }] },
                    { finishType: 'SPIN', points: -1, parts: [{ partId: 2 }] },
                ],
            },
        ]);

        const stats = await statsService.getPartsList();
        const statsA = stats.find(p => p.id === 1);
        const statsB = stats.find(p => p.id === 2);

        expect(statsA?.elo).toBe(625);
        expect(statsB?.elo).toBe(375);
        expect(statsA?.elo).toBeGreaterThan(statsB?.elo!);
    });

    it('should apply XTREME weight and produce a more decisive rating gap', async () => {
        // Colley with 2 battles: Part 1 wins both (SPIN weight=1.0, XTREME weight=2.5).
        //   C = [[4,-2],[-2,4]], b = [2.75, -0.75]
        //   r[0] ≈ 0.7917 → 792 | r[1] ≈ 0.2083 → 208
        (prisma.part.findMany as jest.Mock).mockResolvedValue([
            { id: 1, name: 'Dran Sword',  partType: { name: 'Blade' }, battleEntries: [] },
            { id: 2, name: 'Hell Scythe', partType: { name: 'Blade' }, battleEntries: [] },
        ]);

        (prisma.battle.findMany as jest.Mock).mockResolvedValue([
            {
                id: 1,
                createdAt: new Date('2024-01-01'),
                entries: [
                    { finishType: 'SPIN',   points:  1, parts: [{ partId: 1 }] },
                    { finishType: 'SPIN',   points: -1, parts: [{ partId: 2 }] },
                ],
            },
            {
                id: 2,
                createdAt: new Date('2024-01-02'),
                entries: [
                    { finishType: 'XTREME', points:  3, parts: [{ partId: 1 }] },
                    { finishType: 'XTREME', points: -3, parts: [{ partId: 2 }] },
                ],
            },
        ]);

        const stats = await statsService.getPartsList();
        const statsA = stats.find(p => p.id === 1);
        const statsB = stats.find(p => p.id === 2);

        expect(statsA?.elo).toBe(792);
        expect(statsB?.elo).toBe(208);
    });
});
