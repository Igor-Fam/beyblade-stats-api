import { Request, Response } from 'express';
import { prisma } from '../database';

export class PartTypeController {

    async create(req: Request, res: Response): Promise<void> {
        try {
            const { name } = req.body;

            if (!name) {
                res.status(400).json({ error: 'The "name" field is required.' });
                return;
            }

            const newPartType = await prisma.partType.create({
                data: { name }
            });

            res.status(201).json(newPartType);
        } catch (error) {
            console.error("Error creating part type:", error);
            res.status(500).json({ error: 'Internal server error while creating part type.' });
        }
    }

    async list(req: Request, res: Response): Promise<void> {
        try {
            const partTypes = await prisma.partType.findMany();
            res.status(200).json(partTypes);
        } catch (error) {
            console.error("Error fetching part types:", error);
            res.status(500).json({ error: 'Internal server error while fetching part types.' });
        }
    }
}