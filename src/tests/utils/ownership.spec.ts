import { ensureDatabaseOwnership } from '../../utils/ownership';
import { prisma } from '../../database';
import { AppError } from '../../errors/AppError';

jest.mock('../../database', () => ({
    prisma: {
        database: {
            findUnique: jest.fn()
        }
    }
}));

describe('ensureDatabaseOwnership', () => {
    const userId = 'user-123';
    const databaseId = 'db-456';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should throw error if databaseId is missing', async () => {
        await expect(ensureDatabaseOwnership('', userId))
            .rejects.toThrow(new AppError('databaseId is required.', 400));
    });

    it('should throw 404 if database does not exist', async () => {
        (prisma.database.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(ensureDatabaseOwnership(databaseId, userId))
            .rejects.toThrow(new AppError('Database not found.', 404));
    });

    it('should throw 403 if user does not own the database', async () => {
        (prisma.database.findUnique as jest.Mock).mockResolvedValue({
            ownerId: 'different-user'
        });

        await expect(ensureDatabaseOwnership(databaseId, userId))
            .rejects.toThrow(new AppError('Unauthorized access to this database.', 403));
    });

    it('should succeed if user owns the database', async () => {
        (prisma.database.findUnique as jest.Mock).mockResolvedValue({
            ownerId: userId
        });

        await expect(ensureDatabaseOwnership(databaseId, userId))
            .resolves.not.toThrow();
        
        expect(prisma.database.findUnique).toHaveBeenCalledWith({
            where: { id: databaseId },
            select: { ownerId: true }
        });
    });
});
