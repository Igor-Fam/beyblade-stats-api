import { Request, Response } from 'express';
import { prisma } from '../database';
import { AppError } from '../errors/AppError';

interface LocalBattleEntry {
    lineId: number;
    finishType: string;
    points: number;
    partIds: number[];
}

interface LocalBattle {
    id: string; // UUID
    databaseId: string;
    createdAt: string;
    updatedAt: string;
    stadiumId?: number;
    entries: LocalBattleEntry[];
}

/**
 * POST /battles/sync
 * Receives an array of LocalBattle objects and persists them to the cloud.
 * Uses UUID for deduplication and updatedAt for LWW conflict resolution.
 */
export async function syncBattles(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const { battles }: { battles: LocalBattle[] } = req.body;

    if (!Array.isArray(battles) || battles.length === 0) {
        throw new AppError('Request body must contain a non-empty battles array.', 400);
    }

    // 1. Verify that all databases being synced belong to the user
    const dbIds = [...new Set(battles.map(b => b.databaseId))];
    const userDbs = await prisma.database.findMany({
        where: { id: { in: dbIds }, ownerId: userId },
        select: { id: true }
    });
    const authorizedDbIds = new Set(userDbs.map(d => d.id));

    const authorizedBattles = battles.filter(b => authorizedDbIds.has(b.databaseId));

    if (authorizedBattles.length === 0) {
        throw new AppError('No authorized databases found in sync request.', 403);
    }

    // 2. Fetch existing battles in these databases to check for updates
    // We MUST filter by authorizedDbIds to prevent updating battles owned by other users
    const existingBattles = await prisma.battle.findMany({
        where: { 
            id: { in: authorizedBattles.map(b => b.id) },
            databaseId: { in: Array.from(authorizedDbIds) }
        },
        select: { id: true, updatedAt: true }
    });
    const existingMap = new Map(existingBattles.map(b => [b.id, b.updatedAt.getTime()]));

    let createdCount = 0;
    let updatedCount = 0;

    // 3. Process battles
    for (const battle of authorizedBattles) {
        const remoteUpdatedAt = existingMap.get(battle.id);
        const localUpdatedAt = new Date(battle.updatedAt).getTime();

        if (remoteUpdatedAt === undefined) {
            // New Battle
            await prisma.battle.create({
                data: {
                    id: battle.id,
                    databaseId: battle.databaseId,
                    createdAt: new Date(battle.createdAt),
                    updatedAt: new Date(battle.updatedAt),
                    stadiumId: battle.stadiumId ?? null,
                    entries: {
                        create: battle.entries.map(entry => ({
                            lineId: entry.lineId,
                            finishType: entry.finishType,
                            points: entry.points,
                            comboHash: entry.partIds.slice().sort().join('-'),
                            parts: {
                                create: entry.partIds.map(partId => ({ partId }))
                            }
                        }))
                    }
                }
            });
            createdCount++;
        } else if (localUpdatedAt > remoteUpdatedAt) {
            // LWW: Update existing battle
            // Note: We delete and recreate entries/parts for simplicity in this schema
            await prisma.$transaction([
                prisma.battleEntry.deleteMany({ where: { battleId: battle.id } }),
                prisma.battle.update({
                    where: { id: battle.id },
                    data: {
                        updatedAt: new Date(battle.updatedAt),
                        stadiumId: battle.stadiumId ?? null,
                        entries: {
                            create: battle.entries.map(entry => ({
                                lineId: entry.lineId,
                                finishType: entry.finishType,
                                points: entry.points,
                                comboHash: entry.partIds.slice().sort().join('-'),
                                parts: {
                                    create: entry.partIds.map(partId => ({ partId }))
                                }
                            }))
                        }
                    }
                })
            ]);
            updatedCount++;
        }
    }

    res.status(200).json({ synced: createdCount + updatedCount, created: createdCount, updated: updatedCount });
}

/**
 * GET /battles/restore
 * Returns all battles belonging to any of the user's databases.
 */
export async function restoreBattles(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;

    const battles = await prisma.battle.findMany({
        where: { database: { ownerId: userId } },
        orderBy: { updatedAt: 'desc' },
        include: {
            entries: {
                include: {
                    parts: { select: { partId: true } }
                }
            }
        }
    });

    const result: LocalBattle[] = battles.map(b => ({
        id: b.id,
        databaseId: b.databaseId,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
        stadiumId: b.stadiumId ?? undefined,
        entries: b.entries.map(e => ({
            lineId: e.lineId,
            finishType: e.finishType,
            points: e.points,
            partIds: e.parts.map(p => p.partId)
        }))
    }));

    res.json({ battles: result });
}
