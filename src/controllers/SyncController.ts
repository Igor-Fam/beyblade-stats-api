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
    createdAt: string;
    stadiumId?: number;
    entries: LocalBattleEntry[];
}

/**
 * POST /battles/sync
 * Receives an array of LocalBattle objects and persists them to the cloud
 * linked to the authenticated user. Uses createdAt + userId as a deduplication key.
 */
export async function syncBattles(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const { battles }: { battles: LocalBattle[] } = req.body;

    if (!Array.isArray(battles) || battles.length === 0) {
        throw new AppError('Request body must contain a non-empty battles array.', 400);
    }

    // Fetch already-synced timestamps for this user to avoid duplicates
    const existingBattles = await prisma.battle.findMany({
        where: { userId },
        select: { createdAt: true }
    });
    const existingTimestamps = new Set(existingBattles.map(b => b.createdAt.toISOString()));

    // Filter out battles already in the cloud
    const newBattles = battles.filter(b => !existingTimestamps.has(new Date(b.createdAt).toISOString()));

    if (newBattles.length === 0) {
        res.json({ synced: 0, message: 'All battles already synced.' });
        return;
    }

    // Persist each new battle with its entries and parts
    const created = await Promise.all(
        newBattles.map(battle =>
            prisma.battle.create({
                data: {
                    createdAt: new Date(battle.createdAt),
                    stadiumId: battle.stadiumId ?? null,
                    userId,
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
        )
    );

    res.status(201).json({ synced: created.length });
}

/**
 * GET /battles/restore
 * Returns all battles belonging to the authenticated user
 * in the LocalBattle format expected by the frontend IndexedDB.
 */
export async function restoreBattles(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;

    const battles = await prisma.battle.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
            entries: {
                include: {
                    parts: { select: { partId: true } }
                }
            }
        }
    });

    const result: LocalBattle[] = battles.map(b => ({
        createdAt: b.createdAt.toISOString(),
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
