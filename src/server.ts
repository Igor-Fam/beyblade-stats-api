import express, { Request, Response } from 'express';
import { router } from './routes';

import { ComboValidatorFactory } from './domain/validators/ComboValidatorFactory';
import { StandardComboValidator } from './domain/validators/strategies/StandardComboValidator';

// Inicializando motor do Strategy de validações
const standardValidator = new StandardComboValidator();
ComboValidatorFactory.register('BX', standardValidator);
ComboValidatorFactory.register('UX', standardValidator);

const app = express();
const PORT = process.env.PORT || 3000;

// Parse incoming JSON requests
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'Beyblade Stats API is online and ready for battles!' });
});

// Delegate '/api' requisitions to router's index.ts file
app.use('/api', router);

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});