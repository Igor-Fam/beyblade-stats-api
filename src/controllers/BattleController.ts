import { Request, Response } from 'express';
import { BattleService, CreateBattleDTO } from '../services/BattleService';
import { AppError } from '../errors/AppError';
import { prisma } from '../database';
import { AppCache } from '../utils/cache';
import { StatsService } from '../services/StatsService';
import { ensureDatabaseOwnership } from '../utils/ownership';

export class BattleController {

    async listBattles(req: Request, res: Response): Promise<void> {
        try {
            const page = Math.max(1, parseInt(req.query.page as string) || 1);
            const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
            const databaseId = req.query.databaseId as string;
            const skip = (page - 1) * limit;

            if (!databaseId) {
                throw new AppError('databaseId query parameter is required.', 400);
            }

            // Verify ownership
            await ensureDatabaseOwnership(databaseId, req.userId!);

            const [total, battles] = await Promise.all([
                prisma.battle.count({ where: { databaseId } }),
                prisma.battle.findMany({
                    where: { databaseId },
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        stadium: true,
                        entries: {
                            include: {
                                line: true,
                                parts: {
                                    include: {
                                        part: {
                                            include: { partType: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                })
            ]);

            res.json({ total, page, limit, battles });
        } catch (error: any) {
            console.error('Error listing battles:', error);
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Internal server error.' });
            }
        }
    }

    async registerBattle(req: Request, res: Response): Promise<void> {
        try {
            const input: CreateBattleDTO = req.body as CreateBattleDTO;
            
            // Verify ownership
            await ensureDatabaseOwnership(input.databaseId, req.userId!);

            const battleService = new BattleService();
            const newBattle = await battleService.registerBattle(input);
            AppCache.clear();
            
            // Pre-warm the main stats list in the background
            const statsService = new StatsService();
            statsService.getPartsList(input.databaseId).catch(e => console.error('Cache pre-warm failed:', e));

            res.status(201).json(newBattle);
        } catch (error: any) {
            console.error("Error registering battle:", error);

            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Internal server error while registering battle.' });
            }
        }
    }

    async deleteBattle(req: Request, res: Response): Promise<Response> {
        try {
            const battleId = req.params.id as string;

            if (!battleId) {
                return res.status(400).json({ error: "Invalid battle ID." });
            }

            // Verify ownership via database
            const battle = await prisma.battle.findUnique({
                where: { id: battleId },
                select: { databaseId: true }
            });

            if (!battle) {
                throw new AppError('Battle not found.', 404);
            }

            await ensureDatabaseOwnership(battle.databaseId, req.userId!);

            const battleService = new BattleService();
            const deletedBattle = await battleService.deleteBattle(battleId);
            AppCache.clear();
            
            // Note: Cache pre-warm is harder here without databaseId, but sync handles it
            return res.status(200).json(deletedBattle);
        } catch (error: any) {
            console.error("Error deleting battle:", error);

            if (error instanceof AppError) {
                return res.status(error.statusCode).json({ error: error.message });
            } else {
                return res.status(500).json({ error: 'Internal server error while deleting battle.' });
            }
        }
    }

    async getBattle(req: Request, res: Response): Promise<void> {
        try {
            const battleId = req.params.id as string;

            if (!battleId) {
                res.status(400).json({ error: "Invalid battle ID." });
                return;
            }

            const battle = await prisma.battle.findUnique({
                where: { id: battleId },
                include: {
                    stadium: true,
                    entries: {
                        include: {
                            line: true,
                            parts: {
                                include: {
                                    part: {
                                        include: { partType: true }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (!battle) {
                res.status(404).json({ error: "Battle not found." });
                return;
            }

            // Verify ownership
            await ensureDatabaseOwnership(battle.databaseId, req.userId!);

            res.json(battle);
        } catch (error: any) {
            console.error('Error fetching battle details:', error);
            res.status(500).json({ error: 'Internal server error.' });
        }
    }
}
