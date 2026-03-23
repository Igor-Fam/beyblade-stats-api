import { PartType } from '../../prisma/generated/client';
import { prisma } from '../database';
import { AppError } from '../errors/AppError';

export class PartTypeService {
    async create(name: string): Promise<PartType> {
        if (!name) {
            throw new AppError('The "name" field is required.');
        }

        const newPartType = await prisma.partType.create({
            data: { name }
        });

        return newPartType;
    }

    async list(): Promise<PartType[]> {
        const partTypes = await prisma.partType.findMany();
        return partTypes;
    }
}