import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';

export type AuthRequest = Request & { userId?: string; userEmail?: string };

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, saved: string): boolean {
  const [salt, expectedHex] = saved.split(':');
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function requireAuth(pool: Pool, request: Request, response: Response, next: NextFunction) {
  const token = request.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    response.status(401).json({ error: 'Sign in to continue.' });
    return;
  }
  try {
    const result = await pool.query<{ user_id: string; email: string }>(`
      SELECT u.id AS user_id, u.email
      FROM user_sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > NOW()
      LIMIT 1
    `, [hashToken(token)]);
    const user = result.rows[0];
    if (!user) {
      response.status(401).json({ error: 'Your session has expired. Sign in again.' });
      return;
    }
    const authRequest = request as AuthRequest;
    authRequest.userId = user.user_id;
    authRequest.userEmail = user.email;
    next();
  } catch (error) {
    next(error);
  }
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}
