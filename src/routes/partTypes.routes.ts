import { Router } from 'express';
import { PartTypeController } from '../controllers/PartTypeController';

export const partTypesRoutes = Router();
const partTypeController = new PartTypeController();

partTypesRoutes.post('/', partTypeController.create);
partTypesRoutes.get('/', partTypeController.list);