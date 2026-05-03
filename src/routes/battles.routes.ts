import { Router } from "express";
import { BattleController } from "../controllers/BattleController";
import { authMiddleware } from "../middleware/AuthMiddleware";
import { syncBattles, restoreBattles } from "../controllers/SyncController";

export const battlesRoutes = Router();
const battleController = new BattleController();

// Premium Sync Routes (Must come BEFORE /:id to avoid conflicts)
battlesRoutes.post('/sync', authMiddleware, (req, res, next) => syncBattles(req, res).catch(next));
battlesRoutes.get('/restore', authMiddleware, (req, res, next) => restoreBattles(req, res).catch(next));

battlesRoutes.get('/', battleController.listBattles);
battlesRoutes.get('/:id', battleController.getBattle);
battlesRoutes.post('/', battleController.registerBattle);
battlesRoutes.delete('/:id', battleController.deleteBattle);

