import { Request, Response } from 'express';
import { LineService } from '../services/LineService';
import { AppError } from '../errors/AppError';

export class LineController {

    async create(req: Request, res: Response): Promise<void> {
        try {
            const { name } = req.body;

            const lineService = new LineService();
            const newLine = await lineService.create(name);

            res.status(201).json(newLine);
        } catch (error: any) {
            console.error("Error creating line:", error);
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Internal server error while creating line.' });
            }
        }
    }

    async list(req: Request, res: Response): Promise<void> {
        try {
            const lineService = new LineService();
            const lines = await lineService.list();
            res.status(200).json(lines);
        } catch (error) {
            console.error("Error fetching lines:", error);
            res.status(500).json({ error: 'Internal server error while fetching lines.' });
        }
    }
}