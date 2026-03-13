import { Part } from '@prisma/client';
import { prisma } from '../database';
import { AppError } from '../errors/AppError';

export class PartService {
    async create(name: string, partTypeId: number): Promise<Part> {
        if (!name) {
            throw new AppError('The "name" field is required.');
        }

        if (!partTypeId) {
            throw new AppError('The "partTypeId" field is required.');
        }

        const newPart = await prisma.part.create({
            data: { name, partTypeId }
        });

        return newPart;
    }

    async list(): Promise<Part[]> {
        const parts = await prisma.part.findMany();
        return parts;
    }
}