import { Part } from '../../prisma/generated/client';
import { prisma } from '../database';
import { AppError } from '../errors/AppError';

export interface CreatePartDTO {
    name: string;
    partTypeId: number;
    lineId?: number; // Opcional
    metadata?: any;  // Opcional JSON
}

export class PartService {
    async create(data: CreatePartDTO): Promise<Part> {
        if (!data.name) {
            throw new AppError('The "name" field is required.');
        }

        if (!data.partTypeId) {
            throw new AppError('The "partTypeId" field is required.');
        }

        const newPart = await prisma.part.create({
            data: {
                name: data.name,
                partTypeId: data.partTypeId,
                lineId: data.lineId || null,
                metadata: data.metadata || null
            }
        });

        return newPart;
    }

    async list(lineIdToFilter?: number): Promise<Part[]> {
        const whereClause = lineIdToFilter ? {
            OR: [
                { lineId: lineIdToFilter },
                { lineId: null }
            ]
        } : {};

        const parts = await prisma.part.findMany({
            where: whereClause,
            include: {
                partType: true
            }
        });
        return parts;
    }
}