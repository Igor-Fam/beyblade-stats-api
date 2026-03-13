import { Router } from "express";
import { PartController } from "../controllers/PartController";

export const partsRoutes = Router();
const partController = new PartController();

partsRoutes.post('/', partController.create);
partsRoutes.get('/', partController.list);
