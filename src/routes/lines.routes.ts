import { Router } from 'express';
import { LineController } from '../controllers/LineController';

export const linesRoutes = Router();
const lineController = new LineController();

linesRoutes.post('/', lineController.create);
linesRoutes.get('/', lineController.list);