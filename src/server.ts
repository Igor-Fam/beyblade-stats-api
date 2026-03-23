import express, { Request, Response } from 'express';
import cors from 'cors';
import { router } from './routes';

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
app.get('/api/health', (req: Request, res: Response) => {
    const dbUrl = process.env.DATABASE_URL || '';
    const isProd = dbUrl.includes('supabase.com') || dbUrl.includes('aws-1-sa-east-1');
    res.json({ 
        status: 'online', 
        env: isProd ? 'production' : 'sandbox' 
    });
});

// Delegate '/api' requisitions to router's index.ts file
app.use('/api', router);

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});