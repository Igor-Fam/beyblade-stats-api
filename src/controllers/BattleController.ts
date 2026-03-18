import { Request, Response } from 'express';
import { BattleService, CreateBattleDTO } from '../services/BattleService';
import { AppError } from '../errors/AppError';

export class BattleController {

    async registerBattle(req: Request, res: Response): Promise<void> {
        try {
            const input: CreateBattleDTO = req.body as CreateBattleDTO;
            const battleService = new BattleService();
            const newBattle = await battleService.registerBattle(input);

            res.status(201).json(newBattle);
        } catch (error: any) {
            console.error("Error registering battle:", error);

            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Internal server error while registering battle.' });
            }
        }
    }
}