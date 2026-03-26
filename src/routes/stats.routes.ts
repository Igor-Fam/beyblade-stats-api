import { Router } from "express";
import { StatsController } from "../controllers/StatsController";

export const statsRoutes = Router();
const statsController = new StatsController();

statsRoutes.get('/parts', statsController.getPartsList);
statsRoutes.get('/parts/:id/winrate', statsController.getPartWinRate);
