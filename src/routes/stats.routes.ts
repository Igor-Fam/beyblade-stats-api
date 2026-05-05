import { Router } from "express";
import { StatsController } from "../controllers/StatsController";
import { authMiddleware } from "../middleware/AuthMiddleware";

export const statsRoutes = Router();
const statsController = new StatsController();

statsRoutes.use(authMiddleware);

statsRoutes.get('/parts', (req, res, next) => statsController.getPartsList(req, res).catch(next));
statsRoutes.get('/parts/:id', (req, res, next) => statsController.getPartDetails(req, res).catch(next));
statsRoutes.get('/parts/:id/winrate', (req, res, next) => statsController.getPartWinRate(req, res).catch(next));
