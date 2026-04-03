import { Router } from "express";
import { BattleController } from "../controllers/BattleController";

export const battlesRoutes = Router();
const battleController = new BattleController();

battlesRoutes.get('/', battleController.listBattles);
battlesRoutes.get('/:id', battleController.getBattle);
battlesRoutes.post('/', battleController.registerBattle);
battlesRoutes.delete('/:id', battleController.deleteBattle);

