import { Router } from "express";
import { StadiumController } from "../controllers/StadiumController";

export const stadiumsRoutes = Router();
const stadiumController = new StadiumController();

stadiumsRoutes.get('/', stadiumController.list);
