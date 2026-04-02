import { Request, Response } from 'express';
import { BattleService, CreateBattleDTO } from '../services/BattleService';
import { AppError } from '../errors/AppError';
import { prisma } from '../database';

export class BattleController {

    async listBattles(req: Request, res: Response): Promise<void> {
        try {
            const page = Math.max(1, parseInt(req.query.page as string) || 1);
            const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
            const skip = (page - 1) * limit;

            const [total, battles] = await Promise.all([
                prisma.battle.count(),
                prisma.battle.findMany({
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
            res.status(500).json({ error: 'Internal server error.' });
        }
    }

    async registerBattle(req: Request, res: Response): Promise<void> {
        try {
            const input: CreateBattleDTO = req.body as CreateBattleDTO;
            const battleService = new BattleService();
            const newBattle = await battleService.registerBattle(input);

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
            const battleId = parseInt(req.params.id as string);

            if (isNaN(battleId)) {
                return res.status(400).json({ error: "Invalid battle ID." });
            }


            const battleService = new BattleService();
            const newBattle = await battleService.deleteBattle(battleId);

            return res.status(200).json(newBattle);
        } catch (error: any) {
            console.error("Error deleting battle:", error);

            if (error instanceof AppError) {
                return res.status(error.statusCode).json({ error: error.message });
            } else {
                return res.status(500).json({ error: 'Internal server error while deleting battle.' });
            }
        }
    }
}