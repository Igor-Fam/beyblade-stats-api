import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Extends Express Request to carry the authenticated userId
declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

/**
 * Validates the Supabase JWT Bearer token and attaches userId to the request.
 * Returns 401 if the token is missing, invalid, or expired.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or malformed Authorization header.' });
        return;
    }

    const token = authHeader.split(' ')[1];

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
        res.status(401).json({ error: 'Invalid or expired token.' });
        return;
    }

    req.userId = data.user.id;
    next();
}
