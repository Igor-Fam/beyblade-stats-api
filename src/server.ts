import express, { Request, Response } from 'express';
import cors from 'cors';
import { router } from './routes';
import { prisma } from './database';
import { authMiddleware } from './middleware/AuthMiddleware';
import { syncBattles, restoreBattles } from './controllers/SyncController';

import { ComboValidatorFactory } from './domain/validators/ComboValidatorFactory';
import { StandardComboValidator } from './domain/validators/strategies/StandardComboValidator';
import { PartTypes } from './domain/enums/PartTypes';

// Inicializando motor do Strategy de validações
ComboValidatorFactory.register('BX', new StandardComboValidator([PartTypes.BLADE, PartTypes.RATCHET, PartTypes.BIT]));
ComboValidatorFactory.register('UX', new StandardComboValidator([PartTypes.BLADE, PartTypes.RATCHET, PartTypes.BIT]));
ComboValidatorFactory.register('CX', new StandardComboValidator([PartTypes.LOCK_CHIP, PartTypes.MAIN_BLADE, PartTypes.ASSIST_BLADE, PartTypes.RATCHET, PartTypes.BIT]));
ComboValidatorFactory.register('BX Expand', new StandardComboValidator([PartTypes.BLADE, PartTypes.RATCHET, PartTypes.BIT]));
ComboValidatorFactory.register('UX Expand', new StandardComboValidator([PartTypes.BLADE, PartTypes.BIT]));
ComboValidatorFactory.register('CX Expand', new StandardComboValidator([PartTypes.LOCK_CHIP, PartTypes.OVER_BLADE, PartTypes.METAL_BLADE, PartTypes.ASSIST_BLADE, PartTypes.RATCHET, PartTypes.BIT]));

const app = express();

// Habilitar CORS para o frontend (Vite)
app.use(cors());

const PORT = process.env.PORT || 3000;

// Parse incoming JSON requests
app.use(express.json());

// Health check endpoint
app.get('/api/health', async (req: Request, res: Response) => {
    try {
        const dbUrl = process.env.DATABASE_URL || '';
        const isProd = dbUrl.includes('supabase.com') || dbUrl.includes('aws-1-sa-east-1');
        
        // PING DB to keep it warm (avoids 5s cold start)
        await prisma.$queryRaw`SELECT 1`;

        res.json({ 
            status: 'online', 
            db: 'connected',
            env: isProd ? 'production' : 'sandbox' 
        });
    } catch (e) {
        res.status(500).json({ status: 'error', message: 'DB connection failed' });
    }
});

// Delegate '/api' requisitions to router's index.ts file
app.use('/api', router);

// Premium cloud sync routes (require valid Supabase JWT)
app.post('/api/battles/sync', authMiddleware, (req, res, next) => syncBattles(req, res).catch(next));
app.get('/api/battles/restore', authMiddleware, (req, res, next) => restoreBattles(req, res).catch(next));

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});