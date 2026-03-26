import { prisma } from '../database';
import { AppError } from '../errors/AppError';
import { ComboValidatorFactory } from '../domain/validators/ComboValidatorFactory';
import { ComboPart } from '../domain/validators/IComboValidator';
import { FinishTypes } from '../domain/enums/FinishTypes';
import { EloCalculator } from '../domain/utils/EloCalculator';

export interface CreateBattleEntryDTO {
    lineId: number;
    partsIds: number[];
}

export interface CreateBattleDTO {
    entries: CreateBattleEntryDTO[];
    finishType: string;
    winner: number;
    stadiumId: number;
}

interface Combo {
    line: string,
    parts: ComboPart[],
    points: number,
    avgRating: number,
    ratingChange: number
}

export class BattleService {
    public async registerBattle(data: CreateBattleDTO) {
        if (!data.stadiumId || isNaN(data.stadiumId)) {
            throw new AppError('A stadium must be selected.');
        }

        if (data.entries.length !== 2) {
            throw new AppError('A battle must have exactly 2 entries.');
        }

        if (!data.finishType || !Object.values(FinishTypes).includes(data.finishType as any)) {
            throw new AppError(`Invalid finish type. Valid options are: ${Object.values(FinishTypes).join(', ')}`);
        }

        if (data.winner === null || ![0, 1].includes(data.winner)) {
            throw new AppError('Invalid winner index. Must be 0 or 1.');
        }

        const combos: Combo[] = await Promise.all(
            data.entries.map((entry) => getComboFromEntry(entry))
        );

        const finishTypePoints = {
            "SPIN": 1,
            "OVER": 2,
            "BURST": 2,
            "XTREME": 3
        }

        const eloMultipliers = {
            "SPIN": 1.0,
            "OVER": 1.8,
            "BURST": 1.8,
            "XTREME": 2.5
        };

        const eloMultiplier = eloMultipliers[data.finishType as keyof typeof eloMultipliers];
        const battlePoints = finishTypePoints[data.finishType as keyof typeof finishTypePoints];

        // Validation, Points and Avg Rating calculation
        combos.forEach((combo: Combo, index: number) => {
            ComboValidatorFactory.getValidator(combo.line).validate(combo.parts);

            const isWinner = data.winner === index;
            combo.points = battlePoints * (isWinner ? 1 : -1);
            combo.avgRating = EloCalculator.calculateAverageRating(combo.parts.map(p => p.eloRating));
        });

        // Elo Change calculation (needs avgRating from both sides)
        combos.forEach((combo: Combo, index: number) => {
            const otherCombo = combos[index === 1 ? 0 : 1];
            const expectedScore = EloCalculator.calculateExpectedScore(combo.avgRating, otherCombo.avgRating);
            const isWinner = data.winner === index;

            // Calculate Δ using the 1.0/1.8/2.5 multipliers
            combo.ratingChange = EloCalculator.calculateRatingChange(isWinner ? 1 : 0, expectedScore, eloMultiplier);
        });

        // Battle creation + Elo updates for all parts
        const [battle] = await prisma.$transaction([
            prisma.battle.create({
                data: {
                    stadiumId: data.stadiumId,
                    entries: {
                        create: combos.map((combo, index) => {
                            const pureComboHash = combo.parts.map(p => p.id).sort((a, b) => a - b).join('-');

                            return {
                                lineId: data.entries[index].lineId,
                                finishType: data.finishType,
                                points: combo.points,
                                comboHash: pureComboHash,
                                parts: {
                                    create: combo.parts.map(p => ({
                                        partId: p.id
                                    }))
                                }
                            };
                        })
                    }
                },
                include: {
                    entries: true
                }
            }),
            // Update Elo for both combos' parts
            ...combos[0].parts.map(p => prisma.part.update({
                where: { id: p.id },
                data: { eloRating: { increment: combos[0].ratingChange } }
            })),
            ...combos[1].parts.map(p => prisma.part.update({
                where: { id: p.id },
                data: { eloRating: { increment: combos[1].ratingChange } }
            }))
        ]);

        return {
            message: "Battle successfully registered!",
            battleId: (battle as any).id,
            eloChanges: {
                winner: combos[data.winner].ratingChange,
                loser: combos[data.winner === 0 ? 1 : 0].ratingChange
            }
        };
    }

    public async deleteBattle(id: number) {
        try {
            await prisma.battle.delete({
                where: { id }
            });

            return { message: "Battle successfully deleted!" };
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new AppError("Battle not found or already deleted.", 404);
            }
            throw error;
        }
    }
}

async function getComboFromEntry(entry: CreateBattleEntryDTO): Promise<Combo> {
    if (!entry.lineId) {
        throw new AppError("Undefined line for combo.");
    }

    const line = await prisma.line.findUniqueOrThrow({
        where: {
            id: entry.lineId
        }
    });

    const parts = await prisma.part.findMany({
        where: {
            id: {
                in: entry.partsIds
            }
        },
        include: {
            partType: true
        }
    });

    const invalidPart = (parts as ComboPart[]).find((part: ComboPart) => part.lineId !== null && part.lineId !== entry.lineId);

    if (invalidPart) {
        throw new AppError(`Part '${invalidPart.name}' is incompatible with line '${line.name}'`);
    }

    return {
        line: line.name,
        parts: parts as ComboPart[],
        points: 0,
        avgRating: 0,
        ratingChange: 0
    };
}