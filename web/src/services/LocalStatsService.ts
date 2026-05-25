import { db, type LocalBattle } from '../lib/db';
import { ColleyCalculator, type ColleyBattle } from './ColleyCalculator';

const DEFAULT_COLLEY = 500;
const DEPENDENCY_POINTS_THRESHOLD = 20;
const DEPENDENCY_POINT_SHARE = 0.50;
const DEPENDENCY_SCORING_RATE_DROP = 10;
const ANALYTICS_MIN_BATTLES = 10;
const INACCURATE_BATTLES_THRESHOLD = 15;
const ANALYTICS_LIMIT = 6;
const DEFAULT_SCORING_RATE = 50;
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
    bp: number;
    totalMatches: number;
    wins: number;
    losses: number;
    winRate: string;
    avgPoints: number;
    scoringRate: number;
    pointsGained: number;
    pointsConceded: number;
    isDependent: boolean;
    isInaccurate: boolean;
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

export interface PartComboStatsDTO {
    lineName: string;
    parts: { id: number; name: string; type: string }[];
    totalMatches: number;
    gained: number;
    conceded: number;
    scoringRate: number;
}

export interface PartDetailsDTO extends PartStatsDTO {
    totalGained: number;
    totalConceded: number;
    bestPartners: { id: number; name: string; type: string; scoringRate: number; totalMatches: number }[];
    bestCounters: { id: number; name: string; type: string; scoringRate: number; totalMatches: number }[];
    allPartners: { id: number; name: string; type: string; scoringRate: number; totalMatches: number }[];
    allCounters: { id: number; name: string; type: string; scoringRate: number; totalMatches: number }[];
    combos: PartComboStatsDTO[];
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
    avgBp: number;
}

interface WinRateData {
    partId: number;
    partName: string;
    totalMatches: number;
    wins: number;
    winRate: string | null;
    totalPoints: number;
}

export class LocalStatsService {
    private async getEffectivePartIdMap(): Promise<Map<number, number>> {
        const parts = await db.parts.toArray();
        const lockChips = parts.filter(p => p.partType.name === 'LOCK_CHIP');
        const map = new Map<number, number>();
        lockChips.forEach(p => {
            const metadata = p.metadata as any;
            map.set(p.id, metadata?.isMetal ? VIRTUAL_ID_METAL_LOCK_CHIP : VIRTUAL_ID_LOCK_CHIP);
        });
        return map;
    }

    private buildDexieBattleFilter(conditions?: BattleFilterCondition[], timezoneOffset: number = 0) {
        return (battle: LocalBattle) => {
            if (!conditions || conditions.length === 0) return true;
            for (const cond of conditions) {
                if (cond.field === 'stadium') {
                    if (battle.stadiumId !== Number(cond.value)) return false;
                } else if (cond.field === 'finishType') {
                    const hasFinish = battle.entries.some(e => e.finishType === String(cond.value));
                    if (!hasFinish) return false;
                } else if (cond.field === 'date') {
                    const bDate = new Date(battle.createdAt);
                    const cDate = new Date(String(cond.value));
                    cDate.setUTCMinutes(cDate.getUTCMinutes() + timezoneOffset);
                    if (cond.operator === 'eq') {
                        const start = new Date(cDate); start.setUTCHours(0, 0, 0, 0);
                        const end = new Date(cDate); end.setUTCHours(23, 59, 59, 999);
                        if (bDate < start || bDate > end) return false;
                    } else if (cond.operator === 'gt') {
                        if (bDate <= cDate) return false;
                    } else if (cond.operator === 'lt') {
                        if (bDate >= cDate) return false;
                    }
                }
            }
            return true;
        };
    }

    private calculateColleyRatingsFromBattles(battles: LocalBattle[], effectiveIdMap: Map<number, number>, partIds: number[]): Map<number, number> {
        const getEffectiveId = (id: number) => effectiveIdMap.get(id) ?? id;

        const colleyBattles: ColleyBattle[] = battles.map(battle => {
            const entry0 = battle.entries[0];
            const entry1 = battle.entries[1];
            if (!entry0 || !entry1) return null;
            const isWinner0 = entry0.points > 0;
            const finishWeight = ColleyCalculator.getFinishWeight(entry0.finishType);

            return {
                winnerPartIds: (isWinner0 ? entry0 : entry1).partIds.map(id => getEffectiveId(id)),
                loserPartIds: (isWinner0 ? entry1 : entry0).partIds.map(id => getEffectiveId(id)),
                finishWeight,
            };
        }).filter(b => b !== null) as ColleyBattle[];

        return ColleyCalculator.calculate(partIds, colleyBattles);
    }

    private async calculateColleyRatings(filterFn: (b: LocalBattle) => boolean): Promise<Map<number, number>> {
        const allBattles = await db.battles.toArray();
        const battles = allBattles.filter(filterFn);
        const effectiveIdMap = await this.getEffectivePartIdMap();
        
        const getEffectiveId = (id: number) => effectiveIdMap.get(id) ?? id;
        const parts = await db.parts.toArray();

        const partIdsSet = new Set<number>();
        parts.forEach(p => partIdsSet.add(getEffectiveId(p.id)));
        const partIds = Array.from(partIdsSet);

        return this.calculateColleyRatingsFromBattles(battles, effectiveIdMap, partIds);
    }

    async getPartWinRate(partId: number, conditions?: BattleFilterCondition[], timezoneOffset: number = 0): Promise<WinRateData> {
        const battleWhere = this.buildDexieBattleFilter(conditions, timezoneOffset);
        const isVirtual = partId < 0;

        let targetPartIds: number[] = [];
        let name = '';

        if (isVirtual) {
            const metalFilter = partId === VIRTUAL_ID_METAL_LOCK_CHIP;
            name = partId === VIRTUAL_ID_METAL_LOCK_CHIP ? VIRTUAL_NAME_METAL_LOCK_CHIP : VIRTUAL_NAME_LOCK_CHIP;

            const allParts = await db.parts.toArray();
            const lockChips = allParts.filter(p => p.partType.name === 'LOCK_CHIP');

            const validChips = lockChips.filter(p => {
                const metadata = p.metadata as any;
                return (metadata?.isMetal === true) === metalFilter;
            });

            if (validChips.length === 0) {
                throw new Error('Category not found or has no parts.');
            }
            targetPartIds = validChips.map(p => p.id);
        } else {
            const part = await db.parts.get(partId);
            if (!part) {
                throw new Error('Part not found.');
            }
            targetPartIds = [part.id];
            name = part.name;
        }

        const allBattles = await db.battles.toArray();
        const filteredBattles = allBattles.filter(battleWhere);

        let totalMatches = 0;
        let wins = 0;
        let totalPoints = 0;

        filteredBattles.forEach(battle => {
            battle.entries.forEach(entry => {
                const usesPart = entry.partIds.some(id => targetPartIds.includes(id));
                if (usesPart) {
                    totalMatches++;
                    totalPoints += entry.points;
                    if (entry.points > 0) wins++;
                }
            });
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
        const battleWhere = this.buildDexieBattleFilter(conditions, timezoneOffset);

        const allParts = await db.parts.toArray();
        const effectiveIdMap = await this.getEffectivePartIdMap();
        const allBattles = await db.battles.toArray();
        const battles = allBattles.filter(battleWhere);

        const getEffectiveId = (id: number) => effectiveIdMap.get(id) ?? id;
        
        const partsMap = new Map<number, any>();
        const partIdsSet = new Set<number>();
        allParts.forEach(p => {
            const effId = getEffectiveId(p.id);
            partsMap.set(p.id, p);
            partIdsSet.add(effId);
        });

        const partIds = Array.from(partIdsSet);
        const colleyRatings = this.calculateColleyRatingsFromBattles(battles, effectiveIdMap, partIds);

        const aggregatedStats = new Map<number, any>();

        allParts.forEach(part => {
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
        });

        battles.forEach(battle => {
            const entry0 = battle.entries[0];
            const entry1 = battle.entries[1];
            if (!entry0 || !entry1) return;

            [entry0, entry1].forEach(entry => {
                entry.partIds.forEach(partId => {
                    const effectiveId = getEffectiveId(partId);
                    const stats = aggregatedStats.get(effectiveId);
                    if (!stats) return;

                    stats.totalMatches++;
                    stats.totalPoints += entry.points;

                    if (entry.points > 0) {
                        stats.wins++;
                        stats.totalGained += entry.points;
                    } else {
                        stats.losses++;
                        stats.totalConceded += Math.abs(entry.points);
                    }

                    entry.partIds.forEach(partnerId => {
                        const partnerEffId = getEffectiveId(partnerId);
                        if (partnerEffId !== effectiveId) {
                            if (!stats.partnerStats[partnerEffId]) {
                                const isVP = partnerEffId < 0;
                                const pData = isVP ? null : partsMap.get(partnerId);
                                stats.partnerStats[partnerEffId] = {
                                    name: isVP ? (partnerEffId === VIRTUAL_ID_LOCK_CHIP ? VIRTUAL_NAME_LOCK_CHIP : VIRTUAL_NAME_METAL_LOCK_CHIP) : (pData?.name || 'Unknown'),
                                    type: isVP ? 'LOCK_CHIP' : (pData?.partType?.name || 'Unknown'),
                                    isInfluential: isVP ? false : (true), // Simplification: local parts can be influential
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
                });
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
                isInaccurate: stats.totalMatches > 0 && stats.totalMatches < INACCURATE_BATTLES_THRESHOLD,
                dependencies
            };
        });

        return statsArray.sort((a, b) => {
            if (a.totalMatches === 0 && b.totalMatches === 0) return 0;
            if (a.totalMatches === 0) return 1;
            if (b.totalMatches === 0) return -1;
            return b.bp - a.bp;
        });
    }

    async getPartDetails(partId: number, conditions?: BattleFilterCondition[], timezoneOffset: number = 0): Promise<PartDetailsDTO> {
        const battleWhere = this.buildDexieBattleFilter(conditions, timezoneOffset);
        const effectiveIdMap = await this.getEffectivePartIdMap();
        const getEffectiveId = (id: number) => effectiveIdMap.get(id) ?? id;
        const allParts = await db.parts.toArray();
        const partsMap = new Map(allParts.map(p => [p.id, p]));

        const isVirtual = partId < 0;
        let targetPartIds: number[] = [];
        let virtualName = '';
        let virtualType = 'LOCK_CHIP';
        let firstPartName = '';

        if (isVirtual) {
            const metalFilter = partId === VIRTUAL_ID_METAL_LOCK_CHIP;
            virtualName = partId === VIRTUAL_ID_METAL_LOCK_CHIP ? VIRTUAL_NAME_METAL_LOCK_CHIP : VIRTUAL_NAME_LOCK_CHIP;
            
            const lockChips = allParts.filter(p => p.partType.name === 'LOCK_CHIP');
            const validChips = lockChips.filter(p => {
                const metadata = p.metadata as any;
                return (metadata?.isMetal === true) === metalFilter;
            });
            
            if (validChips.length === 0) throw new Error('Category not found or has no parts.');
            targetPartIds = validChips.map(p => p.id);
        } else {
            const part = partsMap.get(partId);
            if (!part) throw new Error('Part not found.');
            targetPartIds = [part.id];
            firstPartName = part.name;
            virtualType = part.partType.name;
        }

        const allBattles = await db.battles.toArray();
        const filteredBattles = allBattles.filter(battleWhere);

        let totalMatches = 0;
        let wins = 0;
        let losses = 0;
        let totalPoints = 0;
        let totalGained = 0;
        let totalConceded = 0;

        const winFinishes: Record<string, number> = { SPIN: 0, OVER: 0, BURST: 0, XTREME: 0 };
        const lossFinishes: Record<string, number> = { SPIN: 0, OVER: 0, BURST: 0, XTREME: 0 };

        const colleyRatings = await this.calculateColleyRatings(battleWhere);

        const partnerStats: Record<number, any> = {};
        const counterStats: Record<number, any> = {};
        const comboStats: Record<string, any> = {};
        const linesMap = new Map((await db.lines.toArray()).map(l => [l.id, l]));

        filteredBattles.forEach(battle => {
            const entry0 = battle.entries[0];
            const entry1 = battle.entries[1];
            if (!entry0 || !entry1) return;

            [entry0, entry1].forEach((myEntry, idx) => {
                const opponentEntry = idx === 0 ? entry1 : entry0;
                
                const usesPart = myEntry.partIds.some(id => targetPartIds.includes(id));
                if (!usesPart) return;

                totalMatches++;
                const isWin = myEntry.points > 0;
                totalPoints += myEntry.points;

                const sortedPartIds = [...myEntry.partIds].sort((a, b) => a - b);
                const comboKey = `${myEntry.lineId}_${sortedPartIds.join('-')}`;
                if (!comboStats[comboKey]) {
                    comboStats[comboKey] = {
                        lineId: myEntry.lineId,
                        partIds: sortedPartIds,
                        gained: 0,
                        conceded: 0,
                        matches: 0,
                        totalPoE: 0
                    };
                }

                if (isWin) {
                    wins++;
                    totalGained += myEntry.points;
                    winFinishes[myEntry.finishType] = (winFinishes[myEntry.finishType] || 0) + 1;
                    comboStats[comboKey].gained += myEntry.points;
                } else {
                    losses++;
                    totalConceded += Math.abs(myEntry.points);
                    lossFinishes[myEntry.finishType] = (lossFinishes[myEntry.finishType] || 0) + 1;
                    comboStats[comboKey].conceded += Math.abs(myEntry.points);
                }
                comboStats[comboKey].matches++;

                const multiplier = myEntry.finishType === 'XTREME' ? 2.5 : myEntry.finishType === 'OVER' || myEntry.finishType === 'BURST' ? 1.8 : 1.0;
                const poe = isWin ? 1 * multiplier : -1 * multiplier;
                comboStats[comboKey].totalPoE += poe;

                myEntry.partIds.forEach(pId => {
                    const pEffId = getEffectiveId(pId);
                    if (pEffId !== partId) {
                        if (!partnerStats[pEffId]) {
                            const pData = partsMap.get(pId);
                            partnerStats[pEffId] = {
                                name: pEffId < 0 ? (pEffId === VIRTUAL_ID_LOCK_CHIP ? VIRTUAL_NAME_LOCK_CHIP : VIRTUAL_NAME_METAL_LOCK_CHIP) : (pData?.name || 'Unknown'),
                                type: pEffId < 0 ? 'LOCK_CHIP' : (pData?.partType?.name || 'Unknown'),
                                gained: 0, conceded: 0, matches: 0, totalPoE: 0, isInfluential: true
                            };
                        }
                        if (isWin) partnerStats[pEffId].gained += myEntry.points;
                        else partnerStats[pEffId].conceded += Math.abs(myEntry.points);
                        partnerStats[pEffId].matches++;
                        partnerStats[pEffId].totalPoE += poe;
                    }
                });

                opponentEntry.partIds.forEach(pId => {
                    const pEffId = getEffectiveId(pId);
                    if (!counterStats[pEffId]) {
                        const pData = partsMap.get(pId);
                        counterStats[pEffId] = {
                            name: pEffId < 0 ? (pEffId === VIRTUAL_ID_LOCK_CHIP ? VIRTUAL_NAME_LOCK_CHIP : VIRTUAL_NAME_METAL_LOCK_CHIP) : (pData?.name || 'Unknown'),
                            type: pEffId < 0 ? 'LOCK_CHIP' : (pData?.partType?.name || 'Unknown'),
                            myGained: 0, myConceded: 0, matches: 0, totalPoE: 0
                        };
                    }
                    if (isWin) counterStats[pEffId].myGained += myEntry.points;
                    else counterStats[pEffId].myConceded += Math.abs(myEntry.points);
                    counterStats[pEffId].matches++;
                    counterStats[pEffId].totalPoE += poe;
                });
            });
        });

        const computeList = (statsObj: Record<number, any>, isCounter: boolean) => {
            return Object.entries(statsObj)
                .map(([id, data]: [string, any]) => {
                    const sum = isCounter ? (data.myGained + data.myConceded) : (data.gained + data.conceded);
                    const rawRate = sum > 0 ? ((isCounter ? data.myGained : data.gained) / sum) : 0.5;
                    const avgPoE = data.totalPoE / data.matches;
                    const normalizedPoE = ((avgPoE / 2.5) + 1) / 2;
                    const efficiency = (rawRate * 0.4) + (normalizedPoE * 0.6);

                    return {
                        id: Number(id),
                        name: data.name,
                        type: data.type,
                        totalMatches: data.matches,
                        avgPoints: Number((((isCounter ? data.myGained - data.myConceded : data.gained - data.conceded)) / data.matches).toFixed(2)),
                        scoringRate: Number((efficiency * 100).toFixed(2))
                    };
                });
        };

        const allPartnersRaw = computeList(partnerStats, false);
        const allCountersRaw = computeList(counterStats, true);

        const bestPartners = allPartnersRaw
            .filter(p => p.totalMatches >= ANALYTICS_MIN_BATTLES)
            .sort((a, b) => b.scoringRate - a.scoringRate)
            .slice(0, ANALYTICS_LIMIT);

        const bestCounters = allCountersRaw
            .filter(p => p.totalMatches >= ANALYTICS_MIN_BATTLES)
            .sort((a, b) => a.scoringRate - b.scoringRate)
            .slice(0, ANALYTICS_LIMIT);

        const allPartners = allPartnersRaw
            .filter(p => p.totalMatches > 0)
            .sort((a, b) => b.scoringRate - a.scoringRate);

        const allCounters = allCountersRaw
            .filter(p => p.totalMatches > 0)
            .sort((a, b) => a.scoringRate - b.scoringRate);

        const combos = Object.values(comboStats)
            .map((c: any) => {
                const sum = c.gained + c.conceded;
                const rawRate = sum > 0 ? (c.gained / sum) : 0.5;
                const avgPoE = c.totalPoE / c.matches;
                const normalizedPoE = ((avgPoE / 2.5) + 1) / 2;
                const efficiency = (rawRate * 0.4) + (normalizedPoE * 0.6);

                const line = linesMap.get(c.lineId);
                const lineName = line ? line.name : 'Unknown';

                const parts = c.partIds.map((pId: number) => {
                    const pData = partsMap.get(pId);
                    return {
                        id: pId,
                        name: pData?.name || 'Unknown',
                        abbreviation: pData?.abbreviation || '',
                        type: pData?.partType?.name || 'Unknown'
                    };
                });

                return {
                    lineName,
                    parts,
                    totalMatches: c.matches,
                    gained: c.gained,
                    conceded: c.conceded,
                    scoringRate: Number((efficiency * 100).toFixed(2))
                };
            })
            .sort((a, b) => b.scoringRate - a.scoringRate);

        const pointsSum = totalGained + totalConceded;
        const scoringRate = pointsSum > 0 ? Number(((totalGained * 100) / pointsSum).toFixed(2)) : DEFAULT_SCORING_RATE;

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
            name: isVirtual ? virtualName : firstPartName,
            type: virtualType,
            bp: colleyRatings.get(partId) ?? DEFAULT_COLLEY,
            totalMatches, wins, losses,
            winRate: totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(2) + '%' : '0.00%',
            avgPoints: totalMatches > 0 ? Number((totalPoints / totalMatches).toFixed(2)) : 0,
            scoringRate, pointsGained: totalGained, pointsConceded: totalConceded,
            isDependent, isInaccurate: totalMatches > 0 && totalMatches < INACCURATE_BATTLES_THRESHOLD,
            totalGained, totalConceded, bestPartners, bestCounters, allPartners, allCounters, combos, winFinishes, lossFinishes,
            dependencies: totalGained === 0 ? [] : Object.entries(partnerStats)
                .map(([id, data]) => {
                    const sumWith = data.gained + data.conceded;
                    const gainedWithout = totalGained - data.gained;
                    const sumWithout = gainedWithout + (totalConceded - data.conceded);
                    return {
                        id: Number(id), name: data.name, type: data.type,
                        pointsGained: data.gained, conceded: data.conceded,
                        share: Number(((data.gained * 100) / totalGained).toFixed(2)),
                        isInfluential: data.isInfluential,
                        scoringRateWith: sumWith > 0 ? Number(((data.gained * 100) / sumWith).toFixed(2)) : 0,
                        scoringRateWithout: sumWithout > 0 ? Number(((gainedWithout * 100) / sumWithout).toFixed(2)) : 0
                    };
                }).filter(d => {
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
}
