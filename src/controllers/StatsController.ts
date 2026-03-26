import { Request, Response } from 'express';
import { StatsService } from '../services/StatsService';
import { AppError } from '../errors/AppError';

export class StatsController {

    async getPartsList(req: Request, res: Response): Promise<void> {
        try {
            const statsService = new StatsService();
            const parts = await statsService.getPartsList();
            res.status(200).json(parts);
        } catch (error: any) {
            console.error('Error fetching parts list:', error);
            res.status(500).json({ error: 'Internal server error while fetching parts stats.' });
        }
    }

    async getPartWinRate(req: Request, res: Response): Promise<void> {
        try {
            const partId = parseInt(req.params.id as string);

            if (isNaN(partId)) {
                throw new AppError('Invalid part ID format', 400);
            }

            const statsService = new StatsService();
            const stats = await statsService.getPartWinRate(partId);

            res.status(200).json(stats);
        } catch (error: any) {
            console.error('Error fetching generic stats:', error);

            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Internal server error while fetching part stats.' });
            }
        }
    }
}
