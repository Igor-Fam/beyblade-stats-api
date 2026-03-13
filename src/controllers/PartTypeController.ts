import { Request, Response } from 'express';
import { PartTypeService } from '../services/PartTypeService';
import { AppError } from '../errors/AppError';

export class PartTypeController {

    async create(req: Request, res: Response): Promise<void> {
        try {
            const { name } = req.body;
            const partTypeService = new PartTypeService();
            const newPartType = await partTypeService.create(name);

            res.status(201).json(newPartType);
        } catch (error: any) {
            console.error("Error creating part type:", error);

            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Internal server error while creating part type.' });
            }
        }
    }

    async list(req: Request, res: Response): Promise<void> {
        try {
            const partTypeService = new PartTypeService();
            const partTypes = await partTypeService.list();
            res.status(200).json(partTypes);
        } catch (error) {
            console.error("Error fetching part types:", error);
            res.status(500).json({ error: 'Internal server error while fetching part types.' });
        }
    }
}