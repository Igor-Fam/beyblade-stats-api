import { Request, Response } from 'express';
import { StatsService } from '../services/StatsService';
import { AppError } from '../errors/AppError';
import { AppCache } from '../utils/cache';

export class StatsController {
    
    private parseBattleFilters = (queryFilters?: any): any[] => {
        if (typeof queryFilters === 'string') {
            try {
                return JSON.parse(decodeURIComponent(queryFilters));
            } catch (e) {
                console.error("Invalid filters payload format");
            }
        }
        return [];
    }

    getPartsList = async (req: Request, res: Response): Promise<void> => {
        try {
            const filtersStr = req.query.filters as string || '';
            const tz = req.query.tz as string || '0';
            const cacheKey = `partsList_${filtersStr}_${tz}`;

            const cached = AppCache.get(cacheKey);
            if (cached) {
                res.status(200).json(cached);
                return;
            }

            const tStart = Date.now();
            console.log(`[Perf] Starting getPartsList request...`);
            
            const filters = this.parseBattleFilters(req.query.filters);
            const tzParsed = parseInt(tz) || 0;
            const statsService = new StatsService();
            const parts = await statsService.getPartsList(filters, tzParsed);
            
            AppCache.set(cacheKey, parts);
            const tEnd = Date.now();
            console.log(`[Perf] getPartsList Total Time: ${tEnd - tStart}ms`);
            
            res.status(200).json(parts);
        } catch (error: any) {
            console.error('Error fetching parts list:', error);
            res.status(500).json({ error: 'Internal server error while fetching parts stats.' });
        }
    }

    getPartWinRate = async (req: Request, res: Response): Promise<void> => {
        try {
            const partId = parseInt(req.params.id as string);

            if (isNaN(partId)) {
                throw new AppError('Invalid part ID format', 400);
            }

            const filtersStr = req.query.filters as string || '';
            const tz = req.query.tz as string || '0';
            const cacheKey = `partWinRate_${partId}_${filtersStr}_${tz}`;

            const cached = AppCache.get(cacheKey);
            if (cached) {
                res.status(200).json(cached);
                return;
            }

            const filters = this.parseBattleFilters(req.query.filters);
            const tzParsed = parseInt(tz) || 0;
            const statsService = new StatsService();
            const stats = await statsService.getPartWinRate(partId, filters, tzParsed);

            AppCache.set(cacheKey, stats);
            res.status(200).json(stats);
        } catch (error: any) {
            console.error('Error fetching generic stats:', error);

            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Internal server error while fetching part stats.' });
            }
        }
    }

    getPartDetails = async (req: Request, res: Response): Promise<void> => {
        try {
            const partId = parseInt(req.params.id as string);

            if (isNaN(partId)) {
                throw new AppError('Invalid part ID format', 400);
            }

            const filtersStr = req.query.filters as string || '';
            const tz = req.query.tz as string || '0';
            const cacheKey = `partDetails_${partId}_${filtersStr}_${tz}`;

            const cached = AppCache.get(cacheKey);
            if (cached) {
                res.status(200).json(cached);
                return;
            }

            const filters = this.parseBattleFilters(req.query.filters);
            const tzParsed = parseInt(tz) || 0;
            const statsService = new StatsService();
            const details = await statsService.getPartDetails(partId, filters, tzParsed);

            AppCache.set(cacheKey, details);
            res.status(200).json(details);
        } catch (error: any) {
            console.error('Error fetching part details:', error);

            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Internal server error while fetching part details.' });
            }
        }
    }
}
