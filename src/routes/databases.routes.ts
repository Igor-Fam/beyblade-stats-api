import { Router } from "express";
import { DatabaseController } from "../controllers/DatabaseController";
import { authMiddleware } from "../middleware/AuthMiddleware";

export const databasesRoutes = Router();
const databaseController = new DatabaseController();

databasesRoutes.use(authMiddleware);

databasesRoutes.get("/", (req, res, next) => databaseController.list(req, res).catch(next));
databasesRoutes.post("/", (req, res, next) => databaseController.upsert(req, res).catch(next));
databasesRoutes.delete("/:id", (req, res, next) => databaseController.delete(req, res).catch(next));
