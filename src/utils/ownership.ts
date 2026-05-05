import { prisma } from '../database';
import { AppError } from '../errors/AppError';

/**
 * Verifies if a database belongs to a specific user.
 * Throws an AppError if not found or unauthorized.
 */
export async function ensureDatabaseOwnership(databaseId: string, userId: string): Promise<void> {
    if (!databaseId) {
        throw new AppError('databaseId is required.', 400);
    }

    const database = await prisma.database.findUnique({
        where: { id: databaseId },
        select: { ownerId: true }
    });

    if (!database) {
        throw new AppError('Database not found.', 404);
    }

    if (database.ownerId !== userId) {
        throw new AppError('Unauthorized access to this database.', 403);
    }
}
