import express, { Request, Response } from 'express';
import { prisma } from './database';

const app = express();
const PORT = process.env.PORT || 3000;

// Parse incoming JSON requests
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'Beyblade Stats API is online and ready for battles!' });
});

// Create a new Part Type
app.post('/api/part-types', async (req: Request, res: Response): Promise<void> => {
    try {
        const { name } = req.body;

        // Validate request body
        if (!name) {
            res.status(400).json({ error: 'The "name" field is required.' });
            return;
        }

        // Insert new part type into the database
        const newPartType = await prisma.partType.create({
            data: {
                name: name
            }
        });

        // Return the created part type with status 201
        res.status(201).json(newPartType);
    } catch (error) {
        // Log error and return 500 status code
        console.error("Error creating part type:", error);
        res.status(500).json({ error: 'Internal server error while creating part type.' });
    }
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});