import type { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database.js';
import { requireAuth } from '../utils/auth.js';

export function requireSession(request: Request, response: Response, next: NextFunction) {
  if (!pool) {
    response.status(503).json({ error: 'DATABASE_URL is not configured.' });
    return;
  }
  void requireAuth(pool, request, response, next);
}
