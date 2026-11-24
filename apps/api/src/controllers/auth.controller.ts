import type { Request, Response } from 'express';
import { pool } from '../config/database.js';
import { createSessionToken, hashPassword, hashToken, verifyPassword, type AuthRequest } from '../utils/auth.js';
import { databaseOrRespond } from '../utils/request.js';

export async function register(request: Request, response: Response) {
  const db = databaseOrRespond(pool, response);
  if (!db) return;
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
  const password = typeof request.body?.password === 'string' ? request.body.password : '';
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    response.status(400).json({ error: 'Enter a valid email address.' });
    return;
  }
  if (password.length < 8 || password.length > 128) {
    response.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    return;
  }

  try {
    const result = await db.query<{ id: string; email: string }>(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hashPassword(password)],
    );
    const user = result.rows[0];
    const token = createSessionToken();
    await db.query("INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 days')", [user.id, hashToken(token)]);
    response.status(201).json({ token, user });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      response.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }
    console.error('Registration failed:', error);
    response.status(500).json({ error: 'Could not create your account.' });
  }
}

export async function login(request: Request, response: Response) {
  const db = databaseOrRespond(pool, response);
  if (!db) return;
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
  const password = typeof request.body?.password === 'string' ? request.body.password : '';
  try {
    const result = await db.query<{ id: string; email: string; password_hash: string }>(
      'SELECT id, email, password_hash FROM users WHERE email = $1 LIMIT 1', [email],
    );
    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      response.status(401).json({ error: 'Email or password is incorrect.' });
      return;
    }
    const token = createSessionToken();
    await db.query("INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 days')", [user.id, hashToken(token)]);
    response.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Login failed:', error);
    response.status(500).json({ error: 'Could not sign in.' });
  }
}

export function currentUser(request: Request, response: Response) {
  const auth = request as AuthRequest;
  response.json({ user: { id: auth.userId, email: auth.userEmail } });
}

export async function logout(request: Request, response: Response) {
  const db = databaseOrRespond(pool, response);
  if (!db) return;
  const token = request.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  await db.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(token)]);
  response.json({ ok: true });
}
