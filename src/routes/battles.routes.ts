import { Router } from "express";
import { BattleController } from "../controllers/BattleController";

export const battlesRoutes = Router();
const battleController = new BattleController();

battlesRoutes.post('/', battleController.registerBattle);
