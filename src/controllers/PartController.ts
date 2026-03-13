import { Request, Response } from 'express';
import { PartService } from '../services/PartService';
import { AppError } from '../errors/AppError';

export class PartController {

    async create(req: Request, res: Response): Promise<void> {
        try {
            const { name, partTypeId } = req.body;

            const partService = new PartService();
            const newPart = await partService.create(name, partTypeId);

            res.status(201).json(newPart);
        } catch (error: any) {
            console.error("Error creating part:", error);
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Internal server error while creating part.' });
            }
        }
    }

    async list(req: Request, res: Response): Promise<void> {
        try {
            const partService = new PartService();
            const parts = await partService.list();
            res.status(200).json(parts);
        } catch (error) {
            console.error("Error fetching parts:", error);
            res.status(500).json({ error: 'Internal server error while fetching parts.' });
        }
    }
}