import { Router } from "express";
import { BattleController } from "../controllers/BattleController";
import { authMiddleware } from "../middleware/AuthMiddleware";
import { syncBattles, restoreBattles } from "../controllers/SyncController";

export const battlesRoutes = Router();
const battleController = new BattleController();

// Premium Sync Routes (Must come BEFORE /:id to avoid conflicts)
battlesRoutes.post('/sync', authMiddleware, (req, res, next) => syncBattles(req, res).catch(next));
battlesRoutes.get('/restore', authMiddleware, (req, res, next) => restoreBattles(req, res).catch(next));

// All standard battle routes also require authentication
battlesRoutes.use(authMiddleware);

battlesRoutes.get('/', (req, res, next) => battleController.listBattles(req, res).catch(next));
battlesRoutes.get('/:id', (req, res, next) => battleController.getBattle(req, res).catch(next));
battlesRoutes.post('/', (req, res, next) => battleController.registerBattle(req, res).catch(next));
battlesRoutes.delete('/:id', (req, res, next) => battleController.deleteBattle(req, res).catch(next));

