import { Router } from 'express';
import { partTypesRoutes } from './partTypes.routes';
import { linesRoutes } from './lines.routes';
import { partsRoutes } from './parts.routes';
import { battlesRoutes } from './battles.routes';

export const router = Router();

router.use('/part-types', partTypesRoutes);
router.use('/lines', linesRoutes);
router.use('/parts', partsRoutes);
router.use('/battles', battlesRoutes);