import { Line } from '@prisma/client';
import { prisma } from '../database';
import { AppError } from '../errors/AppError';

export class LineService {
    async create(name: string): Promise<Line> {
        if (!name) {
            throw new AppError('The "name" field is required.');
        }

        const newLine = await prisma.line.create({
            data: { name }
        });

        return newLine;
    }

    async list(): Promise<Line[]> {
        const lines = await prisma.line.findMany();
        return lines;
    }
}
