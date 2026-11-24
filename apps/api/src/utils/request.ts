import type { Request, Response } from 'express';
import type { Pool } from 'pg';
import type { AuthRequest } from './auth.js';

export function databaseOrRespond(pool: Pool | null, response: Response): Pool | null {
  if (!pool) response.status(503).json({ error: 'DATABASE_URL is not configured.' });
  return pool;
}

export function getUserId(request: Request): string {
  return (request as AuthRequest).userId!;
}

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
