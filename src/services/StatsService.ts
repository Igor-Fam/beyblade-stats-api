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

    // Runs the sequential Batch Elo calculation across all battles.
    private async calculateBatchElo(filter?: any): Promise<Map<number, number>> {
        const battles = await prisma.battle.findMany({
            where: filter,
            orderBy: { createdAt: 'asc' },
            include: { entries: { include: { parts: true } } }
        });

        const ratings = new Map<number, number>();
        const getRating = (id: number) => ratings.get(id) ?? DEFAULT_ELO;
        const eloMultipliers: Record<string, number> = { SPIN: DEFAULT_ELO_MULTIPLIER, OVER: 1.8, BURST: 1.8, XTREME: 2.5 };

        for (const battle of battles) {
            const entry0 = battle.entries[0];
            const entry1 = battle.entries[1];
            const avgRating0 = EloCalculator.calculateAverageRating(entry0.parts.map(p => getRating(p.partId)));
            const avgRating1 = EloCalculator.calculateAverageRating(entry1.parts.map(p => getRating(p.partId)));
            const multiplier = eloMultipliers[entry0.finishType] ?? DEFAULT_ELO_MULTIPLIER;
            const expected0 = EloCalculator.calculateExpectedScore(avgRating0, avgRating1);
            const expected1 = EloCalculator.calculateExpectedScore(avgRating1, avgRating0);
            const isWinner0 = entry0.points > 0;
            const change0 = EloCalculator.calculateRatingChange(isWinner0 ? 1 : 0, expected0, multiplier);
            const change1 = EloCalculator.calculateRatingChange(!isWinner0 ? 1 : 0, expected1, multiplier);
            entry0.parts.forEach(p => ratings.set(p.partId, getRating(p.partId) + change0));
            entry1.parts.forEach(p => ratings.set(p.partId, getRating(p.partId) + change1));
        }
        return ratings;
    }

    // Fetches all battles, converts to ColleyBattle format, and delegates to ColleyCalculator.
    private async calculateColleyRatings(filter?: any): Promise<Map<number, number>> {
        const battles = await prisma.battle.findMany({
            where: filter,
            include: {
                entries: {
                    include: { parts: true }
                }
            }
        });

        const parts = await prisma.part.findMany({ select: { id: true } });
        const partIds = parts.map(p => p.id);

        const colleyBattles: ColleyBattle[] = battles.map(battle => {
            const entry0 = battle.entries[0];
            const entry1 = battle.entries[1];
            const isWinner0 = entry0.points > 0;
            const finishWeight = ColleyCalculator.getFinishWeight(entry0.finishType);

            return {
                winnerPartIds: (isWinner0 ? entry0 : entry1).parts.map(p => p.partId),
                loserPartIds: (isWinner0 ? entry1 : entry0).parts.map(p => p.partId),
                finishWeight,
            };
        });

        return ColleyCalculator.calculate(partIds, colleyBattles);
    }

    async getPartWinRate(partId: number): Promise<WinRateData> {
        const part = await prisma.part.findUnique({
            where: { id: partId }
        });

        if (!part) {
            throw new AppError('Part not found.', 404);
        }

        const participations = await prisma.battleEntryPart.findMany({
            where: {
                partId: partId
            },
            include: {
                battleEntry: {
                    include: {
                        battle: true
                    }
                }
            }
        });

        const totalMatches = participations.length;

        let wins = 0;
        let totalPoints = 0;

        participations.forEach((participation: any) => {
            const entry = participation.battleEntry;

            totalPoints += entry.points;

            if (entry.points > 0) {
                wins++;
            }
        });

        const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(2) + '%' : '0.00%';

        return {
            partId: part.id,
            partName: part.name,
            totalMatches,
            wins,
            winRate,
            totalPoints
        };
    }

    async getPartsList(): Promise<PartStatsDTO[]> {
        const parts = await prisma.part.findMany({
            include: {
                partType: true,
                battleEntries: {
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
        });

        const [eloRatings, colleyRatings] = await Promise.all([
            this.calculateBatchElo(),
            this.calculateColleyRatings(),
        ]);

        const stats = parts.map(part => {
            const totalMatches = part.battleEntries.length;
            let wins = 0;
            let losses = 0;
            let totalPoints = 0;
            let totalGained = 0;
            let totalConceded = 0;
            const partnerStats: Record<number, { name: string, type: string, isInfluential: boolean, gained: number, conceded: number }> = {};

            part.battleEntries.forEach(participation => {
                const entry = participation.battleEntry;
                totalPoints += entry.points;

                // Track matches with partners regardless of win/loss
                entry.parts.forEach(p => {
                    if (p.partId !== part.id) {
                        if (!partnerStats[p.partId]) {
                            partnerStats[p.partId] = { name: p.part.name, type: p.part.partType.name, isInfluential: p.part.partType.isInfluential, gained: 0, conceded: 0 };
                        }
                        if (entry.points > 0) {
                            partnerStats[p.partId].gained += entry.points;
                        } else {
                            partnerStats[p.partId].conceded += Math.abs(entry.points);
                        }
                    }
                });

                if (entry.points > 0) {
                    wins++;
                    totalGained += entry.points;
                } else {
                    losses++;
                    totalConceded += Math.abs(entry.points);
                }
            });

            const pointsSum = totalGained + totalConceded;
            const scoringRate = pointsSum > 0 ? Number(((totalGained * 100) / pointsSum).toFixed(2)) : DEFAULT_SCORING_RATE;

            // Constata dependência de sinergia
            let isDependent = false;
            let dependencies: DependencyDTO[] = [];
            if (totalGained >= DEPENDENCY_POINTS_THRESHOLD) {
                const dominantPartners = Object.entries(partnerStats).map(([partnerId, p]) => {
                    const pointShare = totalGained > 0 ? p.gained / totalGained : 0;

                    const gainedWithout = totalGained - p.gained;
                    const concededWithout = totalConceded - p.conceded;
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
                id: part.id,
                name: part.name,
                type: part.partType.name,
                elo: Math.round(eloRatings.get(part.id) ?? DEFAULT_ELO),
                bp: colleyRatings.get(part.id) ?? DEFAULT_COLLEY,
                totalMatches,
                wins,
                losses,
                winRate: totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(2) + '%' : '0.00%',
                avgPoints: totalMatches > 0 ? Number((totalPoints / totalMatches).toFixed(2)) : 0,
                scoringRate,
                pointsGained: totalGained,
                pointsConceded: totalConceded,
                isDependent,
                dependencies
            };
        });

        // Default sort: BP (Colley) desc; parts with no battles always go to the bottom.
        return stats.sort((a, b) => {
            if (a.totalMatches === 0 && b.totalMatches === 0) return 0;
            if (a.totalMatches === 0) return 1;
            if (b.totalMatches === 0) return -1;
            return b.bp - a.bp;
        });
    }

    async getPartDetails(partId: number): Promise<PartDetailsDTO> {
        const part = await prisma.part.findUnique({
            where: { id: partId },
            include: {
                partType: true,
                battleEntries: {
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

        const totalMatches = part.battleEntries.length;
        let wins = 0;
        let losses = 0;
        let totalPoints = 0;
        let totalGained = 0;
        let totalConceded = 0;

        const winFinishes: Record<string, number> = { SPIN: 0, OVER: 0, BURST: 0, XTREME: 0 };
        const lossFinishes: Record<string, number> = { SPIN: 0, OVER: 0, BURST: 0, XTREME: 0 };

        const partnerStats: Record<number, { name: string, type: string, gained: number, conceded: number, matches: number, isInfluential: boolean }> = {};
        const counterStats: Record<number, { name: string, type: string, myGained: number, myConceded: number, matches: number }> = {};

        part.battleEntries.forEach(participation => {
            const myEntry = (participation as any).battleEntry;
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

            // Synergies: Same combo
            myEntry.parts.forEach((p: any) => {
                if (p.partId !== partId) {
                    if (!partnerStats[p.partId]) {
                        partnerStats[p.partId] = {
                            name: p.part.name,
                            type: p.part.partType.name,
                            gained: 0,
                            conceded: 0,
                            matches: 0,
                            isInfluential: p.part.partType.isInfluential
                        };
                    }

                    if (myEntry.points > 0) {
                        partnerStats[p.partId].gained += myEntry.points;
                    } else {
                        partnerStats[p.partId].conceded += Math.abs(myEntry.points);
                    }
                    partnerStats[p.partId].matches++;
                }
            });

            // Counters: Opponent combo
            const opponentEntry = battle.entries.find((e: any) => e.id !== myEntry.id);
            if (opponentEntry) {
                opponentEntry.parts.forEach((p: any) => {
                    if (!counterStats[p.partId]) {
                        counterStats[p.partId] = { name: p.part.name, type: p.part.partType.name, myGained: 0, myConceded: 0, matches: 0 };
                    }
                    if (myEntry.points > 0) counterStats[p.partId].myGained += myEntry.points;
                    else counterStats[p.partId].myConceded += Math.abs(myEntry.points);
                    counterStats[p.partId].matches++;
                });
            }
        });

        const bestPartners = Object.entries(partnerStats)
            .map(([id, data]) => {
                const sum = data.gained + data.conceded;
                return {
                    id: Number(id),
                    name: data.name,
                    type: data.type,
                    totalMatches: data.matches,
                    avgPoints: Number(((data.gained - data.conceded) / data.matches).toFixed(2)),
                    scoringRate: sum > 0 ? Number(((data.gained * 100) / sum).toFixed(2)) : DEFAULT_SCORING_RATE
                };
            })
            .filter(p => p.totalMatches >= ANALYTICS_MIN_BATTLES)
            .sort((a, b) => b.scoringRate - a.scoringRate)
            .slice(0, ANALYTICS_LIMIT);

        const bestCounters = Object.entries(counterStats)
            .map(([id, data]) => {
                const sum = data.myGained + data.myConceded;
                return {
                    id: Number(id),
                    name: data.name,
                    type: data.type,
                    totalMatches: data.matches,
                    avgPoints: Number(((data.myGained - data.myConceded) / data.matches).toFixed(2)),
                    scoringRate: sum > 0 ? Number(((data.myGained * 100) / sum).toFixed(2)) : DEFAULT_SCORING_RATE
                };
            })
            .filter(p => p.totalMatches >= ANALYTICS_MIN_BATTLES)
            .sort((a, b) => a.scoringRate - b.scoringRate) // lowest rate = best counter to me
            .slice(0, ANALYTICS_LIMIT);

        const [eloRatings, colleyRatings] = await Promise.all([
            this.calculateBatchElo(),
            this.calculateColleyRatings(),
        ]);

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
            id: part.id,
            name: part.name,
            type: part.partType.name,
            elo: Math.round(eloRatings.get(part.id) ?? DEFAULT_ELO),
            bp: colleyRatings.get(part.id) ?? DEFAULT_COLLEY,
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

            // Explicit dependencies: Influential partners with > 70% share of points gained
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

    async getCombosList(): Promise<ComboStatsDTO[]> {
        const entries = await prisma.battleEntry.findMany({
            include: {
                parts: {
                    include: {
                        part: { include: { partType: true } }
                    }
                }
            }
        });

        const colleyRatings = await this.calculateColleyRatings();

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

    async analyzeCombo(partsIds: number[]): Promise<any> {
        const parts = await prisma.part.findMany({
            where: { id: { in: partsIds } },
            include: { partType: true }
        });

        const colleyRatings = await this.calculateColleyRatings();
        const avgElo = Math.round(parts.reduce((acc, p) => acc + (colleyRatings.get(p.id) ?? DEFAULT_COLLEY), 0) / parts.length);
        const comboHash = partsIds.sort((a, b) => a - b).join('-');

        const historicalEntries = await prisma.battleEntry.findMany({
            where: { comboHash }
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
