import { Request, Response } from 'express';
import { prisma } from '../database';

export class StadiumController {
    async list(req: Request, res: Response) {
        try {
            const stadiums = await prisma.stadium.findMany({
                orderBy: { name: 'asc' }
            });
            res.json(stadiums);
        } catch (error) {
            console.error('Error listing stadiums:', error);
            res.status(500).json({ error: 'Internal server error while fetching stadiums.' });
        }
    }
}
