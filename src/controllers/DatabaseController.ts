import { Request, Response } from 'express';
import { prisma } from '../database';
import { AppError } from '../errors/AppError';

export class DatabaseController {
    /**
     * List all databases for the authenticated user.
     */
    async list(req: Request, res: Response) {
        const userId = req.userId!;
        const databases = await prisma.database.findMany({
            where: { ownerId: userId },
            orderBy: { createdAt: 'desc' }
        });
        return res.json(databases);
    }

    /**
     * Create or update a database record for the user.
     */
    async upsert(req: Request, res: Response) {
        const userId = req.userId!;
        const id = req.body.id as string;
        const name = req.body.name as string;

        if (!id || !name) {
            throw new AppError('ID and Name are required.', 400);
        }

        const existing = await prisma.database.findUnique({
            where: { id }
        });

        if (existing) {
            if (existing.ownerId !== userId) {
                throw new AppError('Unauthorized: This database ID is already claimed by another user.', 403);
            }
            
            const updated = await prisma.database.update({
                where: { id },
                data: { name }
            });
            return res.json(updated);
        }

        const db = await prisma.database.create({
            data: {
                id,
                name,
                ownerId: userId
            }
        });

        return res.json(db);
    }

    /**
     * Delete a database and all its battles.
     */
    async delete(req: Request, res: Response) {
        const userId = req.userId!;
        const id = req.params.id as string;

        const db = await prisma.database.findFirst({
            where: { id, ownerId: userId }
        });

        if (!db) {
            throw new AppError('Database not found or unauthorized.', 404);
        }

        await prisma.database.delete({
            where: { id }
        });

        return res.status(204).send();
    }
}
