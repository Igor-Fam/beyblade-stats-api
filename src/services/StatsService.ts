import { BattleEntryPart, Part } from '../../prisma/generated/client';
import { prisma } from '../database';
import { AppError } from '../errors/AppError';
import { ColleyCalculator, ColleyBattle } from '../domain/utils/ColleyCalculator';
import { EloCalculator } from '../domain/utils/EloCalculator';

const DEFAULT_ELO = 1000;
const DEFAULT_COLLEY = 500;
const DEPENDENCY_POINTS_THRESHOLD = 20;
const DEPENDENCY_POINT_SHARE = 0.50;
const DEPENDENCY_SCORING_RATE_DROP = 10;
const ANALYTICS_MIN_BATTLES = 10;
const ANALYTICS_LIMIT = 6;
const DEFAULT_SCORING_RATE = 50;
const DEFAULT_ELO_MULTIPLIER = 1.0;
const VIRTUAL_ID_LOCK_CHIP = -100;
const VIRTUAL_ID_METAL_LOCK_CHIP = -101;
const VIRTUAL_NAME_LOCK_CHIP = 'part_lock_chip';
const VIRTUAL_NAME_METAL_LOCK_CHIP = 'part_metal_lock_chip';

export interface BattleFilterCondition {
    field: 'stadium' | 'date' | 'finishType';
    operator: 'eq' | 'gt' | 'lt';
    value: string | number;
}

export interface PartStatsDTO {
    id: number;
    name: string;
    type: string;
    elo: number;  // Batch Elo (sequential, strength-aware)
    bp: number;   // Battle Power — Colley Rating (0–1000, order-independent)
    totalMatches: number;
    wins: number;
    losses: number;
    winRate: string;
    avgPoints: number;
    scoringRate: number;
    pointsGained: number;
    pointsConceded: number;
    isDependent: boolean;
    dependencies?: DependencyDTO[];
}

export interface DependencyDTO {
    id: number;
    name: string;
    type: string;
    pointsGained?: number;
    share?: number;
    scoringRateWith: number;
    scoringRateWithout: number;
}

export interface PartDetailsDTO extends PartStatsDTO {
    totalGained: number;
    totalConceded: number;
    bestPartners: { id: number; name: string; type: string; scoringRate: number; totalMatches: number }[];
    bestCounters: { id: number; name: string; type: string; scoringRate: number; totalMatches: number }[];
    winFinishes: Record<string, number>;
    lossFinishes: Record<string, number>;
    dependencies: DependencyDTO[];
}

export interface ComboStatsDTO {
    comboHash: string;
    parts: { id: number; name: string; type: string }[];
    totalMatches: number;
    wins: number;
    losses: number;
    winRate: string;
    avgElo: number;
}

interface WinRateData {
    partId: number;
    partName: string;
    totalMatches: number;
    wins: number;
    winRate: string | null;
    totalPoints: number;
}

export class StatsService {
    private async getEffectivePartIdMap(): Promise<Map<number, number>> {
        const lockChips = await prisma.part.findMany({
            where: { partType: { name: 'LOCK_CHIP' } },
            select: { id: true, metadata: true }
        });
        const map = new Map<number, number>();
        lockChips.forEach(p => {
            const metadata = p.metadata as any;
            map.set(p.id, metadata?.isMetal ? VIRTUAL_ID_METAL_LOCK_CHIP : VIRTUAL_ID_LOCK_CHIP);
        });
        return map;
    }

    private buildPrismaBattleFilter(conditions?: BattleFilterCondition[], timezoneOffset: number = 0): any {
        if (!conditions || conditions.length === 0) return undefined;

        const where: any = {};
        let createdAtFilters: any = {};
        let hasDateFilter = false;

        for (const cond of conditions) {
            if (cond.field === 'stadium') {
                where.stadiumId = Number(cond.value);
            } else if (cond.field === 'finishType') {
                where.entries = {
                    some: {
                        finishType: String(cond.value)
                    }
                };
            } else if (cond.field === 'date') {
                hasDateFilter = true;
                if (cond.operator === 'eq') {
                    // Start of local day
                    const start = new Date(String(cond.value));
                    start.setUTCHours(0, 0, 0, 0);
                    start.setUTCMinutes(start.getUTCMinutes() + timezoneOffset);
                    
                    // End of local day
                    const end = new Date(String(cond.value));
                    end.setUTCHours(23, 59, 59, 999);
                    end.setUTCMinutes(end.getUTCMinutes() + timezoneOffset);
                    
                    createdAtFilters.gte = start;
                    createdAtFilters.lte = end;
                } else if (cond.operator === 'gt') {
                    const date = new Date(String(cond.value));
                    date.setUTCMinutes(date.getUTCMinutes() + timezoneOffset);
                    createdAtFilters.gt = date;
                } else if (cond.operator === 'lt') {
                    const date = new Date(String(cond.value));
                    date.setUTCMinutes(date.getUTCMinutes() + timezoneOffset);
                    createdAtFilters.lt = date;
                }
            }
        }

        if (hasDateFilter) {
            where.createdAt = createdAtFilters;
        }

        return Object.keys(where).length > 0 ? where : undefined;
    }

    // Runs the sequential Batch Elo calculation across all battles.
    private async calculateBatchElo(filter?: any): Promise<Map<number, number>> {
        const [battles, effectiveIdMap] = await Promise.all([
            prisma.battle.findMany({
                where: filter,
                orderBy: { createdAt: 'asc' },
                include: { entries: { include: { parts: true } } }
            }),
            this.getEffectivePartIdMap()
        ]);

        const ratings = new Map<number, number>();
        const getEffectiveId = (id: number) => effectiveIdMap.get(id) ?? id;
        const getRating = (id: number) => ratings.get(id) ?? DEFAULT_ELO;
        const eloMultipliers: Record<string, number> = { SPIN: DEFAULT_ELO_MULTIPLIER, OVER: 1.8, BURST: 1.8, XTREME: 2.5 };

        for (const battle of battles) {
            const entry0 = battle.entries[0];
            const entry1 = battle.entries[1];
            const avgRating0 = EloCalculator.calculateAverageRating(entry0.parts.map(p => getRating(getEffectiveId(p.partId))));
            const avgRating1 = EloCalculator.calculateAverageRating(entry1.parts.map(p => getRating(getEffectiveId(p.partId))));
            const multiplier = eloMultipliers[entry0.finishType] ?? DEFAULT_ELO_MULTIPLIER;
            const expected0 = EloCalculator.calculateExpectedScore(avgRating0, avgRating1);
            const expected1 = EloCalculator.calculateExpectedScore(avgRating1, avgRating0);
            const isWinner0 = entry0.points > 0;
            const change0 = EloCalculator.calculateRatingChange(isWinner0 ? 1 : 0, expected0, multiplier);
            const change1 = EloCalculator.calculateRatingChange(!isWinner0 ? 1 : 0, expected1, multiplier);
            entry0.parts.forEach(p => ratings.set(getEffectiveId(p.partId), getRating(getEffectiveId(p.partId)) + change0));
            entry1.parts.forEach(p => ratings.set(getEffectiveId(p.partId), getRating(getEffectiveId(p.partId)) + change1));
        }
        return ratings;
    }

    // Fetches all battles, converts to ColleyBattle format, and delegates to ColleyCalculator.
    private async calculateColleyRatings(filter?: any): Promise<Map<number, number>> {
        const [battles, effectiveIdMap] = await Promise.all([
            prisma.battle.findMany({
                where: filter,
                include: {
                    entries: {
                        include: { parts: true }
                    }
                }
            }),
            this.getEffectivePartIdMap(),
        ]);

        const getEffectiveId = (id: number) => effectiveIdMap.get(id) ?? id;
        const parts = await prisma.part.findMany({ select: { id: true, partType: true, metadata: true } });
        
        // Final list of IDs must include the virtual ones and exclude the original Lock Chip IDs
        const partIdsSet = new Set<number>();
        parts.forEach(p => {
            partIdsSet.add(getEffectiveId(p.id));
        });
        const partIds = Array.from(partIdsSet);

        const colleyBattles: ColleyBattle[] = battles.map(battle => {
            const entry0 = battle.entries[0];
            const entry1 = battle.entries[1];
            const isWinner0 = entry0.points > 0;
            const finishWeight = ColleyCalculator.getFinishWeight(entry0.finishType);

            return {
                winnerPartIds: (isWinner0 ? entry0 : entry1).parts.map(p => getEffectiveId(p.partId)),
                loserPartIds: (isWinner0 ? entry1 : entry0).parts.map(p => getEffectiveId(p.partId)),
                finishWeight,
            };
        });

        return ColleyCalculator.calculate(partIds, colleyBattles);
    }

    async getPartWinRate(partId: number, conditions?: BattleFilterCondition[], timezoneOffset: number = 0): Promise<WinRateData> {
        const battleWhere = this.buildPrismaBattleFilter(conditions, timezoneOffset);
        const isVirtual = partId < 0;

        let parts: any[] = [];
        let name = '';

        if (isVirtual) {
            const metalFilter = partId === VIRTUAL_ID_METAL_LOCK_CHIP;
            name = partId === VIRTUAL_ID_METAL_LOCK_CHIP ? VIRTUAL_NAME_METAL_LOCK_CHIP : VIRTUAL_NAME_LOCK_CHIP;

            const allLockChips = await prisma.part.findMany({
                where: { partType: { name: 'LOCK_CHIP' } }
            });

            parts = allLockChips.filter(p => {
                const metadata = p.metadata as any;
                return (metadata?.isMetal === true) === metalFilter;
            });

            if (parts.length === 0) {
                throw new AppError('Category not found or has no parts.', 404);
            }
        } else {
            const part = await prisma.part.findUnique({
                where: { id: partId }
            });

            if (!part) {
                throw new AppError('Part not found.', 404);
            }
            parts = [part];
            name = part.name;
        }

        const participations = await prisma.battleEntryPart.findMany({
            where: {
                partId: { in: parts.map(p => p.id) },
                ...(battleWhere ? {
                    battleEntry: {
                        battle: battleWhere
                    }
                } : {})
            },
            include: {
                battleEntry: true
            }
        });

        const totalMatches = participations.length;
        let wins = 0;
        let totalPoints = 0;

        participations.forEach((participation: any) => {
            const entry = participation.battleEntry;
            totalPoints += entry.points;
            if (entry.points > 0) wins++;
        });

        const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(2) + '%' : '0.00%';

        return {
            partId: partId,
            partName: name,
            totalMatches,
            wins,
            winRate,
            totalPoints
        };
    }

    async getPartsList(conditions?: BattleFilterCondition[], timezoneOffset: number = 0): Promise<PartStatsDTO[]> {
        const battleWhere = this.buildPrismaBattleFilter(conditions, timezoneOffset);

        const [parts, effectiveIdMap] = await Promise.all([
            prisma.part.findMany({
                include: {
                    partType: true,
                    battleEntries: {
                        where: battleWhere ? {
                            battleEntry: {
                                battle: battleWhere
                            }
                        } : undefined,
                        include: {
                            battleEntry: {
                                include: {
                                    parts: {
                                        include: {
                                            part: { include: { partType: true } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }),
            this.getEffectivePartIdMap()
        ]);

        const getEffectiveId = (id: number) => effectiveIdMap.get(id) ?? id;

        const [eloRatings, colleyRatings] = await Promise.all([
            this.calculateBatchElo(battleWhere),
            this.calculateColleyRatings(battleWhere),
        ]);

        const aggregatedStats = new Map<number, any>();

        parts.forEach(part => {
            const effectiveId = getEffectiveId(part.id);
            
            if (!aggregatedStats.has(effectiveId)) {
                const isVirtual = effectiveId < 0;
                aggregatedStats.set(effectiveId, {
                    id: effectiveId,
                    name: isVirtual ? (effectiveId === VIRTUAL_ID_LOCK_CHIP ? VIRTUAL_NAME_LOCK_CHIP : VIRTUAL_NAME_METAL_LOCK_CHIP) : part.name,
                    type: part.partType.name,
                    totalMatches: 0,
                    wins: 0,
                    losses: 0,
                    totalPoints: 0,
                    totalGained: 0,
                    totalConceded: 0,
                    partnerStats: {} as Record<number, any>
                });
            }

            const stats = aggregatedStats.get(effectiveId);
            stats.totalMatches += part.battleEntries.length;

            part.battleEntries.forEach(participation => {
                const entry = participation.battleEntry;
                stats.totalPoints += entry.points;

                // Track matches with partners
                entry.parts.forEach(p => {
                    const partnerEffId = getEffectiveId(p.partId);
                    if (partnerEffId !== effectiveId) {
                        if (!stats.partnerStats[partnerEffId]) {
                            stats.partnerStats[partnerEffId] = { 
                                name: partnerEffId < 0 ? (partnerEffId === VIRTUAL_ID_LOCK_CHIP ? VIRTUAL_NAME_LOCK_CHIP : VIRTUAL_NAME_METAL_LOCK_CHIP) : p.part.name, 
                                type: p.part.partType.name, 
                                isInfluential: p.part.partType.isInfluential, 
                                gained: 0, 
                                conceded: 0 
                            };
                        }
                        if (entry.points > 0) {
                            stats.partnerStats[partnerEffId].gained += entry.points;
                        } else {
                            stats.partnerStats[partnerEffId].conceded += Math.abs(entry.points);
                        }
                    }
                });

                if (entry.points > 0) {
                    stats.wins++;
                    stats.totalGained += entry.points;
                } else {
                    stats.losses++;
                    stats.totalConceded += Math.abs(entry.points);
                }
            });
        });

        const statsArray: PartStatsDTO[] = Array.from(aggregatedStats.values()).map(stats => {
            const pointsSum = stats.totalGained + stats.totalConceded;
            const scoringRate = pointsSum > 0 ? Number(((stats.totalGained * 100) / pointsSum).toFixed(2)) : DEFAULT_SCORING_RATE;

            let isDependent = false;
            let dependencies: DependencyDTO[] = [];
            
            if (stats.totalGained >= DEPENDENCY_POINTS_THRESHOLD) {
                const dominantPartners = Object.entries(stats.partnerStats).map(([partnerId, p]: [string, any]) => {
                    const pointShare = stats.totalGained > 0 ? p.gained / stats.totalGained : 0;
                    const gainedWithout = stats.totalGained - p.gained;
                    const concededWithout = stats.totalConceded - p.conceded;
                    const pointsSumWithout = gainedWithout + concededWithout;
                    const scoringRateWithout = pointsSumWithout > 0 ? (gainedWithout * 100) / pointsSumWithout : 0;
                    const drop = scoringRate - scoringRateWithout;
                    const scoringRateWith = (p.gained + p.conceded) > 0 ? (p.gained * 100) / (p.gained + p.conceded) : 0;

                    return { id: Number(partnerId), data: p, pointShare, drop, scoringRateWith, scoringRateWithout };
                }).filter(p => {
                    if (!p.data.isInfluential) return false;
                    if (p.pointShare < DEPENDENCY_POINT_SHARE || p.data.gained < DEPENDENCY_POINTS_THRESHOLD) return false;
                    return p.drop > DEPENDENCY_SCORING_RATE_DROP;
                });
                
                isDependent = dominantPartners.length > 0;
                dependencies = dominantPartners.map(d => ({
                    id: d.id,
                    name: d.data.name,
                    type: d.data.type,
                    scoringRateWith: Number(d.scoringRateWith.toFixed(2)),
                    scoringRateWithout: Number(d.scoringRateWithout.toFixed(2))
                }));
            }

            return {
                id: stats.id,
                name: stats.name,
                type: stats.type,
                elo: Math.round(eloRatings.get(stats.id) ?? DEFAULT_ELO),
                bp: colleyRatings.get(stats.id) ?? DEFAULT_COLLEY,
                totalMatches: stats.totalMatches,
                wins: stats.wins,
                losses: stats.losses,
                winRate: stats.totalMatches > 0 ? ((stats.wins / stats.totalMatches) * 100).toFixed(2) + '%' : '0.00%',
                avgPoints: stats.totalMatches > 0 ? Number((stats.totalPoints / stats.totalMatches).toFixed(2)) : 0,
                scoringRate,
                pointsGained: stats.totalGained,
                pointsConceded: stats.totalConceded,
                isDependent,
                dependencies
            };
        });

        // Default sort: BP (Colley) desc; parts with no battles always go to the bottom.
        return statsArray.sort((a, b) => {
            if (a.totalMatches === 0 && b.totalMatches === 0) return 0;
            if (a.totalMatches === 0) return 1;
            if (a.totalMatches === 0) return -1;
            return b.bp - a.bp;
        });
    }

    async getPartDetails(partId: number, conditions?: BattleFilterCondition[], timezoneOffset: number = 0): Promise<PartDetailsDTO> {
        const battleWhere = this.buildPrismaBattleFilter(conditions, timezoneOffset);
        const effectiveIdMap = await this.getEffectivePartIdMap();
        const getEffectiveId = (id: number) => effectiveIdMap.get(id) ?? id;

        const isVirtual = partId < 0;
        let parts: any[] = [];
        let virtualName = '';
        let virtualType = 'LOCK_CHIP';

        if (isVirtual) {
            const metalFilter = partId === VIRTUAL_ID_METAL_LOCK_CHIP;
            virtualName = partId === VIRTUAL_ID_METAL_LOCK_CHIP ? VIRTUAL_NAME_METAL_LOCK_CHIP : VIRTUAL_NAME_LOCK_CHIP;
            
            parts = await prisma.part.findMany({
                where: { 
                    partType: { name: virtualType }
                },
                include: {
                    partType: true,
                    battleEntries: {
                        where: battleWhere ? {
                            battleEntry: {
                                battle: battleWhere
                            }
                        } : undefined,
                        include: {
                            battleEntry: {
                                include: {
                                    parts: {
                                        include: {
                                            part: { include: { partType: true } }
                                        }
                                    },
                                    battle: {
                                        include: {
                                            entries: {
                                                include: {
                                                    parts: {
                                                        include: {
                                                            part: { include: { partType: true } }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            // Filter parts by metadata effectively (simulating the grouping)
            parts = parts.filter(p => {
                const metadata = p.metadata as any;
                return (metadata?.isMetal === true) === metalFilter;
            });
            
            if (parts.length === 0) {
                throw new AppError('Category not found or has no parts.', 404);
            }
        } else {
            const part = await prisma.part.findUnique({
                where: { id: partId },
                include: {
                    partType: true,
                    battleEntries: {
                        where: battleWhere ? {
                            battleEntry: {
                                battle: battleWhere
                            }
                        } : undefined,
                        include: {
                            battleEntry: {
                                include: {
                                    parts: {
                                        include: {
                                            part: { include: { partType: true } }
                                        }
                                    },
                                    battle: {
                                        include: {
                                            entries: {
                                                include: {
                                                    parts: {
                                                        include: {
                                                            part: { include: { partType: true } }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (!part) {
                throw new AppError('Part not found.', 404);
            }
            parts = [part];
        }

        const firstPart = parts[0];
        let totalMatches = 0;
        let wins = 0;
        let losses = 0;
        let totalPoints = 0;
        let totalGained = 0;
        let totalConceded = 0;

        const winFinishes: Record<string, number> = { SPIN: 0, OVER: 0, BURST: 0, XTREME: 0 };
        const lossFinishes: Record<string, number> = { SPIN: 0, OVER: 0, BURST: 0, XTREME: 0 };

        const eloMultipliers: Record<string, number> = { SPIN: 1.0, OVER: 1.8, BURST: 1.8, XTREME: 2.5 };
        const [eloRatings, colleyRatings] = await Promise.all([
            this.calculateBatchElo(battleWhere),
            this.calculateColleyRatings(battleWhere),
        ]);

        const getRating = (id: number) => eloRatings.get(id) ?? DEFAULT_ELO;

        const partnerStats: Record<number, { name: string, type: string, gained: number, conceded: number, matches: number, totalPoE: number, isInfluential: boolean }> = {};
        const counterStats: Record<number, { name: string, type: string, myGained: number, myConceded: number, matches: number, totalPoE: number }> = {};

        parts.forEach(part => {
            totalMatches += part.battleEntries.length;
            part.battleEntries.forEach((participation: any) => {
                const myEntry = participation.battleEntry;
                const battle = myEntry.battle;
                const isWin = myEntry.points > 0;

                totalPoints += myEntry.points;
                if (isWin) {
                    wins++;
                    totalGained += myEntry.points;
                    winFinishes[myEntry.finishType] = (winFinishes[myEntry.finishType] || 0) + 1;
                } else {
                    losses++;
                    totalConceded += Math.abs(myEntry.points);
                    lossFinishes[myEntry.finishType] = (lossFinishes[myEntry.finishType] || 0) + 1;
                }

                // Strength-Adjusted Analytics (PoE)
                const opponentEntry = battle.entries.find((e: any) => e.id !== myEntry.id);
                if (opponentEntry) {
                    const myComboElo = EloCalculator.calculateAverageRating(myEntry.parts.map((p: any) => getRating(getEffectiveId(p.partId))));
                    const opponentComboElo = EloCalculator.calculateAverageRating(opponentEntry.parts.map((p: any) => getRating(getEffectiveId(p.partId))));
                    const expectedScore = EloCalculator.calculateExpectedScore(myComboElo, opponentComboElo);
                    const actualScore = isWin ? 1 : 0;
                    const multiplier = eloMultipliers[myEntry.finishType] ?? 1.0;
                    
                    // PoE normalized by multiplier to keep it in [-1, 1] range conceptually before averaging
                    const poe = (actualScore - expectedScore) * multiplier;

                    // Synergies: Same combo
                    myEntry.parts.forEach((p: any) => {
                        const pEffId = getEffectiveId(p.partId);
                        if (pEffId !== partId) {
                            if (!partnerStats[pEffId]) {
                                partnerStats[pEffId] = {
                                    name: pEffId < 0 ? (pEffId === VIRTUAL_ID_LOCK_CHIP ? VIRTUAL_NAME_LOCK_CHIP : VIRTUAL_NAME_METAL_LOCK_CHIP) : p.part.name,
                                    type: p.part.partType.name,
                                    gained: 0,
                                    conceded: 0,
                                    matches: 0,
                                    totalPoE: 0,
                                    isInfluential: p.part.partType.isInfluential
                                } as any;
                            }

                            if (isWin) partnerStats[pEffId].gained += myEntry.points;
                            else partnerStats[pEffId].conceded += Math.abs(myEntry.points);
                            
                            partnerStats[pEffId].matches++;
                            (partnerStats[pEffId] as any).totalPoE += poe;
                        }
                    });

                    // Counters: Opponent combo
                    opponentEntry.parts.forEach((p: any) => {
                        const pEffId = getEffectiveId(p.partId);
                        if (!counterStats[pEffId]) {
                            counterStats[pEffId] = { 
                                name: pEffId < 0 ? (pEffId === VIRTUAL_ID_LOCK_CHIP ? VIRTUAL_NAME_LOCK_CHIP : VIRTUAL_NAME_METAL_LOCK_CHIP) : p.part.name, 
                                type: p.part.partType.name, 
                                myGained: 0, 
                                myConceded: 0, 
                                matches: 0,
                                totalPoE: 0
                            } as any;
                        }
                        if (isWin) counterStats[pEffId].myGained += myEntry.points;
                        else counterStats[pEffId].myConceded += Math.abs(myEntry.points);
                        
                        counterStats[pEffId].matches++;
                        (counterStats[pEffId] as any).totalPoE += poe;
                    });
                }
            });
        });

        const bestPartners = Object.entries(partnerStats)
            .map(([id, data]: [string, any]) => {
                const sum = data.gained + data.conceded;
                const rawRate = sum > 0 ? (data.gained / sum) : 0.5;
                const avgPoE = data.totalPoE / data.matches;
                
                // Normalization: PoE is roughly within [-2.5, 2.5] due to multipliers. 
                // We map it to [-1, 1] then to [0, 1] for the efficiency score.
                const normalizedPoE = ((avgPoE / 2.5) + 1) / 2;
                const efficiency = (rawRate * 0.4) + (normalizedPoE * 0.6);

                return {
                    id: Number(id),
                    name: data.name,
                    type: data.type,
                    totalMatches: data.matches,
                    avgPoints: Number(((data.gained - data.conceded) / data.matches).toFixed(2)),
                    scoringRate: Number((efficiency * 100).toFixed(2))
                };
            })
            .filter(p => p.totalMatches >= ANALYTICS_MIN_BATTLES)
            .sort((a, b) => b.scoringRate - a.scoringRate)
            .slice(0, ANALYTICS_LIMIT);

        const bestCounters = Object.entries(counterStats)
            .map(([id, data]: [string, any]) => {
                const sum = data.myGained + data.myConceded;
                const rawRate = sum > 0 ? (data.myGained / sum) : 0.5;
                const avgPoE = data.totalPoE / data.matches;
                
                const normalizedPoE = ((avgPoE / 2.5) + 1) / 2;
                const efficiency = (rawRate * 0.4) + (normalizedPoE * 0.6);

                return {
                    id: Number(id),
                    name: data.name,
                    type: data.type,
                    totalMatches: data.matches,
                    avgPoints: Number(((data.myGained - data.myConceded) / data.matches).toFixed(2)),
                    scoringRate: Number((efficiency * 100).toFixed(2))
                };
            })
            .filter(p => p.totalMatches >= ANALYTICS_MIN_BATTLES)
            .sort((a, b) => a.scoringRate - b.scoringRate) // lowest rate = best counter to me
            .slice(0, ANALYTICS_LIMIT);

// Ratings already calculated at the beginning of the function


        const pointsSum = totalGained + totalConceded;
        const scoringRate = pointsSum > 0 ? Number(((totalGained * 100) / pointsSum).toFixed(2)) : DEFAULT_SCORING_RATE;

        // Constata dependência de sinergia
        let isDependent = false;
        if (totalGained >= DEPENDENCY_POINTS_THRESHOLD) {
            const dominantPartners = Object.values(partnerStats).filter(p => {
                if (!p.isInfluential) return false;
                
                const pointShare = totalGained > 0 ? p.gained / totalGained : 0;
                if (pointShare < DEPENDENCY_POINT_SHARE || p.gained < DEPENDENCY_POINTS_THRESHOLD) return false;

                const gainedWithout = totalGained - p.gained;
                const concededWithout = totalConceded - p.conceded;
                const pointsSumWithout = gainedWithout + concededWithout;
                const scoringRateWithout = pointsSumWithout > 0 ? (gainedWithout * 100) / pointsSumWithout : 0;

                const drop = scoringRate - scoringRateWithout;
                return drop > DEPENDENCY_SCORING_RATE_DROP;
            });
            isDependent = dominantPartners.length > 0;
        }

        return {
            id: partId,
            name: isVirtual ? virtualName : firstPart.name,
            type: isVirtual ? virtualType : firstPart.partType.name,
            elo: Math.round(eloRatings.get(partId) ?? DEFAULT_ELO),
            bp: colleyRatings.get(partId) ?? DEFAULT_COLLEY,
            totalMatches,
            wins,
            losses,
            winRate: totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(2) + '%' : '0.00%',
            avgPoints: totalMatches > 0 ? Number((totalPoints / totalMatches).toFixed(2)) : 0,
            scoringRate,
            pointsGained: totalGained,
            pointsConceded: totalConceded,
            isDependent,
            totalGained,
            totalConceded,
            bestPartners,
            bestCounters,
            winFinishes,
            lossFinishes,

            // Explicit dependencies: Influential partners
            dependencies: totalGained === 0 ? [] : Object.entries(partnerStats)
                .map(([id, data]) => {
                    const sumWith = data.gained + data.conceded;
                    const gainedWithout = totalGained - data.gained;
                    const sumWithout = gainedWithout + (totalConceded - data.conceded);
                    return {
                        id: Number(id),
                        name: data.name,
                        type: data.type,
                        pointsGained: data.gained,
                        conceded: data.conceded,
                        share: Number(((data.gained * 100) / totalGained).toFixed(2)),
                        isInfluential: data.isInfluential,
                        scoringRateWith: sumWith > 0 ? Number(((data.gained * 100) / sumWith).toFixed(2)) : 0,
                        scoringRateWithout: sumWithout > 0 ? Number(((gainedWithout * 100) / sumWithout).toFixed(2)) : 0
                    };
                })
                .filter(d => {
                    if (!d.isInfluential) return false;
                    
                    const pointShare = totalGained > 0 ? d.pointsGained / totalGained : 0;
                    if (pointShare < DEPENDENCY_POINT_SHARE || d.pointsGained < DEPENDENCY_POINTS_THRESHOLD) return false;

                    const gainedWithout = totalGained - d.pointsGained;
                    const concededWithout = totalConceded - d.conceded;
                    const pointsSumWithout = gainedWithout + concededWithout;
                    const scoringRateWithout = pointsSumWithout > 0 ? (gainedWithout * 100) / pointsSumWithout : 0;

                    const drop = scoringRate - scoringRateWithout;
                    return drop > DEPENDENCY_SCORING_RATE_DROP;
                })
        };
    }

    async getCombosList(conditions?: BattleFilterCondition[], timezoneOffset: number = 0): Promise<ComboStatsDTO[]> {
        const battleWhere = this.buildPrismaBattleFilter(conditions, timezoneOffset);
        const entries = await prisma.battleEntry.findMany({
            where: battleWhere ? {
                battle: battleWhere
            } : undefined,
            include: {
                parts: {
                    include: {
                        part: { include: { partType: true } }
                    }
                }
            }
        });

        const colleyRatings = await this.calculateColleyRatings(battleWhere);

        const comboGroups: Record<string, {
            parts: { id: number, name: string, type: string }[],
            wins: number,
            losses: number,
            totalElo: number
        }> = {};

        entries.forEach(entry => {
            const hash = entry.comboHash;
            if (!comboGroups[hash]) {
                comboGroups[hash] = {
                    parts: entry.parts.map(p => ({ id: p.partId, name: p.part.name, type: p.part.partType.name })),
                    wins: 0,
                    losses: 0,
                    totalElo: entry.parts.reduce((acc, p) => acc + (colleyRatings.get(p.partId) ?? DEFAULT_COLLEY), 0)
                };
            }

            if (entry.points > 0) comboGroups[hash].wins++;
            else comboGroups[hash].losses++;
        });

        return Object.entries(comboGroups).map(([hash, data]) => {
            const total = data.wins + data.losses;
            return {
                comboHash: hash,
                parts: data.parts,
                totalMatches: total,
                wins: data.wins,
                losses: data.losses,
                winRate: total > 0 ? ((data.wins / total) * 100).toFixed(2) + '%' : '0.00%',
                avgElo: Math.round(data.totalElo / data.parts.length)
            };
        }).sort((a, b) => b.totalMatches - a.totalMatches);
    }

    async analyzeCombo(partsIds: number[], conditions?: BattleFilterCondition[], timezoneOffset: number = 0): Promise<any> {
        const battleWhere = this.buildPrismaBattleFilter(conditions, timezoneOffset);
        const parts = await prisma.part.findMany({
            where: { id: { in: partsIds } },
            include: { partType: true }
        });

        const colleyRatings = await this.calculateColleyRatings(battleWhere);
        const avgElo = Math.round(parts.reduce((acc, p) => acc + (colleyRatings.get(p.id) ?? DEFAULT_COLLEY), 0) / parts.length);
        const comboHash = partsIds.sort((a, b) => a - b).join('-');

        const historicalEntries = await prisma.battleEntry.findMany({
            where: { 
                comboHash,
                ...(battleWhere ? { battle: battleWhere } : {})
            }
        });

        const totalMatches = historicalEntries.length;
        const wins = historicalEntries.filter(e => e.points > 0).length;

        return {
            comboHash,
            parts: parts.map(p => ({ id: p.id, name: p.name, type: p.partType.name })),
            avgElo,
            historicalPerformance: {
                totalMatches,
                wins,
                winRate: totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(2) + '%' : 'N/A'
            }
        };
    }
}
