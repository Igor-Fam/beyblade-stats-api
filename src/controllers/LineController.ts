import { Request, Response } from 'express';
import { prisma } from '../database';

export class LineController {

    async create(req: Request, res: Response): Promise<void> {
        try {
            const { name } = req.body;

            if (!name) {
                res.status(400).json({ error: 'The "name" field is required.' });
                return;
            }

            const newLine = await prisma.line.create({
                data: { name }
            });

            res.status(201).json(newLine);
        } catch (error) {
            console.error("Error creating line:", error);
            res.status(500).json({ error: 'Internal server error while creating line.' });
        }
    }

    async list(req: Request, res: Response): Promise<void> {
        try {
            const lines = await prisma.line.findMany();
            res.status(200).json(lines);
        } catch (error) {
            console.error("Error fetching lines:", error);
            res.status(500).json({ error: 'Internal server error while fetching lines.' });
        }
    }
}