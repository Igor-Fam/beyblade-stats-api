import { BattleEntryPart, Part } from '../../prisma/generated/client';
import { prisma } from '../database';
import { AppError } from '../errors/AppError';
import { EloCalculator } from '../domain/utils/EloCalculator';

export interface PartStatsDTO {
    id: number;
    name: string;
    type: string;
    elo: number;
    totalMatches: number;
    wins: number;
    losses: number;
    winRate: string;
    avgPoints: number;
}

export interface PartDetailsDTO extends PartStatsDTO {
    bestPartners: { id: number; name: string; type: string; count: number }[];
    bestCounters: { id: number; name: string; type: string; count: number }[];
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

    private async calculateBatchElo(filter?: any): Promise<Map<number, number>> {
        const battles = await prisma.battle.findMany({
            where: filter,
            orderBy: { createdAt: 'asc' },
            include: {
                entries: {
                    include: {
                        parts: true
                    }
                }
            }
        });

        const ratings = new Map<number, number>();
        const getRating = (id: number) => ratings.get(id) ?? 1000;

        const eloMultipliers = {
            "SPIN": 1.0,
            "OVER": 1.8,
            "BURST": 1.8,
            "XTREME": 2.5
        };

        for (const battle of battles) {
            const entry0 = battle.entries[0];
            const entry1 = battle.entries[1];

            const avgRating0 = EloCalculator.calculateAverageRating(entry0.parts.map(p => getRating(p.partId)));
            const avgRating1 = EloCalculator.calculateAverageRating(entry1.parts.map(p => getRating(p.partId)));

            const multiplier = eloMultipliers[entry0.finishType as keyof typeof eloMultipliers] || 1.0;
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
                        battleEntry: true
                    }
                }
            }
        });

        const batchRatings = await this.calculateBatchElo();

        const stats = parts.map(part => {
            const totalMatches = part.battleEntries.length;
            let wins = 0;
            let losses = 0;
            let totalPoints = 0;

            part.battleEntries.forEach(participation => {
                const entry = participation.battleEntry;
                totalPoints += entry.points;
                if (entry.points > 0) {
                    wins++;
                } else {
                    losses++;
                }
            });

            return {
                id: part.id,
                name: part.name,
                type: part.partType.name,
                elo: Math.round(batchRatings.get(part.id) ?? 1000),
                totalMatches,
                wins,
                losses,
                winRate: totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(2) + '%' : '0.00%',
                avgPoints: totalMatches > 0 ? Number((totalPoints / totalMatches).toFixed(2)) : 0
            };
        });

        // Sort by Elo Rating DESC
        return stats.sort((a, b) => b.elo - a.elo);
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

        const partnerCounts: Record<number, { name: string, type: string, count: number }> = {};
        const counterCounts: Record<number, { name: string, type: string, count: number }> = {};

        part.battleEntries.forEach(participation => {
            const myEntry = (participation as any).battleEntry;
            const battle = myEntry.battle;
            const isWin = myEntry.points > 0;

            totalPoints += myEntry.points;
            if (isWin) wins++;
            else losses++;

            // Synergy: If I won, who was with me in the same combo?
            if (isWin) {
                myEntry.parts.forEach((p: any) => {
                    if (p.partId !== partId) {
                        if (!partnerCounts[p.partId]) {
                            partnerCounts[p.partId] = { name: p.part.name, type: p.part.partType.name, count: 0 };
                        }
                        partnerCounts[p.partId].count++;
                    }
                });
            }

            // Counters: If I lost, which parts were on the winning opponent's side?
            if (!isWin) {
                const opponentEntry = battle.entries.find((e: any) => e.id !== myEntry.id);
                if (opponentEntry) {
                    opponentEntry.parts.forEach((p: any) => {
                        if (!counterCounts[p.partId]) {
                            counterCounts[p.partId] = { name: p.part.name, type: p.part.partType.name, count: 0 };
                        }
                        counterCounts[p.partId].count++;
                    });
                }
            }
        });

        const bestPartners = Object.entries(partnerCounts)
            .map(([id, data]) => ({ id: Number(id), ...data }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const bestCounters = Object.entries(counterCounts)
            .map(([id, data]) => ({ id: Number(id), ...data }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const batchRatings = await this.calculateBatchElo();

        return {
            id: part.id,
            name: part.name,
            type: part.partType.name,
            elo: Math.round(batchRatings.get(part.id) ?? 1000),
            totalMatches,
            wins,
            losses,
            winRate: totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(2) + '%' : '0.00%',
            avgPoints: totalMatches > 0 ? Number((totalPoints / totalMatches).toFixed(2)) : 0,
            bestPartners,
            bestCounters
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

        const batchRatings = await this.calculateBatchElo();

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
                    totalElo: entry.parts.reduce((acc, p) => acc + (batchRatings.get(p.partId) ?? 1000), 0)
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

        const batchRatings = await this.calculateBatchElo();
        const avgElo = Math.round(parts.reduce((acc, p) => acc + (batchRatings.get(p.id) ?? 1000), 0) / parts.length);
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
