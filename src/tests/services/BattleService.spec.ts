import { BattleService } from '../../../src/services/BattleService';
import { prisma } from '../../../src/database';
import { AppError } from '../../../src/errors/AppError';
import { ComboValidatorFactory } from '../../../src/domain/validators/ComboValidatorFactory';
import { FinishTypes } from '../../../src/domain/enums/FinishTypes';

jest.mock('../../../src/database', () => ({
    prisma: {
        battle: {
            create: jest.fn(),
            delete: jest.fn()
        },
        line: {
            findUniqueOrThrow: jest.fn()
        },
        part: {
            findMany: jest.fn()
        }
    }
}));

jest.mock('../../../src/domain/validators/ComboValidatorFactory', () => ({
    ComboValidatorFactory: {
        getValidator: jest.fn()
    }
}));

describe('BattleService', () => {
    let battleService: BattleService;
    let mockValidator: any;

    beforeEach(() => {
        battleService = new BattleService();
        jest.clearAllMocks();

        mockValidator = {
            validate: jest.fn()
        };
        (ComboValidatorFactory.getValidator as jest.Mock).mockReturnValue(mockValidator);

        (prisma.line.findUniqueOrThrow as jest.Mock).mockResolvedValue({ id: 1, name: 'BX' });

        (prisma.part.findMany as jest.Mock).mockImplementation(async (args) => {
            const ids = args.where.id.in as number[];
            return ids.map((id, idx) => ({
                id,
                name: `Part ${id}`,
                lineId: null,
                partType: { id: idx, name: 'SOME_TYPE' }
            }));
        });
    });

    describe('registerBattle', () => {
        const validPayload = {
            stadiumId: 1,
            finishType: FinishTypes.SPIN,
            winner: 0,
            entries: [
                { lineId: 1, partsIds: [10, 11] },
                { lineId: 1, partsIds: [20, 21] }
            ]
        };

        it('should validate stadiumId', async () => {
            await expect(battleService.registerBattle({ ...validPayload, stadiumId: undefined as any }))
                .rejects.toThrow(new AppError('A stadium must be selected.'));

            await expect(battleService.registerBattle({ ...validPayload, stadiumId: 'not-a-number' as any }))
                .rejects.toThrow(new AppError('A stadium must be selected.'));
        });

        it('should validate entries length', async () => {
            await expect(battleService.registerBattle({ ...validPayload, entries: [{ lineId: 1, partsIds: [1] }] }))
                .rejects.toThrow(new AppError('A battle must have exactly 2 entries.'));
        });

        it('should validate finishType', async () => {
            await expect(battleService.registerBattle({ ...validPayload, finishType: 'INVALID' }))
                .rejects.toThrow(AppError);
        });

        it('should validate winner index', async () => {
            await expect(battleService.registerBattle({ ...validPayload, winner: 2 }))
                .rejects.toThrow(new AppError('Invalid winner index. Must be 0 or 1.'));
        });

        it('should validate incompatible parts with line', async () => {
            (prisma.part.findMany as jest.Mock).mockResolvedValueOnce([
                { id: 10, name: 'InvalidPart', lineId: 2, partType: { name: 'BLADE' } } // Incompatible with lineId 1
            ]);

            await expect(battleService.registerBattle(validPayload))
                .rejects.toThrow(new AppError("Part 'InvalidPart' is incompatible with line 'BX'"));
        });

        it('should call ComboValidatorFactory for validation', async () => {
            (prisma.battle.create as jest.Mock).mockResolvedValue({ id: 100 });
            await battleService.registerBattle(validPayload);
            expect(ComboValidatorFactory.getValidator).toHaveBeenCalledWith('BX');
            expect(mockValidator.validate).toHaveBeenCalledTimes(2); // One for each combo
        });

        it('should calculate zero-sum points correctly based on finish type (SPIN = 1)', async () => {
            (prisma.battle.create as jest.Mock).mockResolvedValue({ id: 100 });
            await battleService.registerBattle({ ...validPayload, finishType: FinishTypes.SPIN, winner: 0 });

            const createCallArgs = (prisma.battle.create as jest.Mock).mock.calls[0][0];
            const entries = createCallArgs.data.entries.create;

            expect(entries[0].points).toBe(1); // Winner
            expect(entries[1].points).toBe(-1); // Loser
        });

        it('should calculate zero-sum points correctly based on finish type (OVER = 2)', async () => {
            (prisma.battle.create as jest.Mock).mockResolvedValue({ id: 100 });
            await battleService.registerBattle({ ...validPayload, finishType: FinishTypes.OVER, winner: 1 });

            const createCallArgs = (prisma.battle.create as jest.Mock).mock.calls[0][0];
            const entries = createCallArgs.data.entries.create;

            expect(entries[0].points).toBe(-2); // Loser
            expect(entries[1].points).toBe(2); // Winner
        });

        it('should calculate zero-sum points correctly based on finish type (XTREME = 3)', async () => {
            (prisma.battle.create as jest.Mock).mockResolvedValue({ id: 100 });
            await battleService.registerBattle({ ...validPayload, finishType: FinishTypes.XTREME, winner: 0 });

            const createCallArgs = (prisma.battle.create as jest.Mock).mock.calls[0][0];
            const entries = createCallArgs.data.entries.create;

            expect(entries[0].points).toBe(3); // Winner
            expect(entries[1].points).toBe(-3); // Loser
        });

        it('should sort parts to create comboHash', async () => {
            (prisma.battle.create as jest.Mock).mockResolvedValue({ id: 100 });
            await battleService.registerBattle({
                ...validPayload,
                entries: [
                    { lineId: 1, partsIds: [5, 2, 8] },
                    { lineId: 1, partsIds: [10, 20] }
                ]
            });

            const createCallArgs = (prisma.battle.create as jest.Mock).mock.calls[0][0];
            expect(createCallArgs.data.entries.create[0].comboHash).toBe('2-5-8');
            expect(createCallArgs.data.entries.create[1].comboHash).toBe('10-20');
        });
    });

    describe('deleteBattle', () => {
        it('should delete battle successfully', async () => {
            (prisma.battle.delete as jest.Mock).mockResolvedValue({ id: 1 });
            const result = await battleService.deleteBattle(1);
            expect(prisma.battle.delete).toHaveBeenCalledWith({ where: { id: 1 } });
            expect(result.message).toBe("Battle successfully deleted!");
        });

        it('should throw AppError if battle is not found (P2025)', async () => {
            const error = new Error('Prisma Error') as any;
            error.code = 'P2025';
            (prisma.battle.delete as jest.Mock).mockRejectedValue(error);

            await expect(battleService.deleteBattle(999))
                .rejects.toThrow(new AppError("Battle not found or already deleted.", 404));
        });

        it('should rethrow unknown errors', async () => {
            const error = new Error('Generic DB Error');
            (prisma.battle.delete as jest.Mock).mockRejectedValue(error);

            await expect(battleService.deleteBattle(999))
                .rejects.toThrow('Generic DB Error');
        });
    });
});
