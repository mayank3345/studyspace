import type { Request, Response } from 'express';
import { pool } from '../config/database.js';
import { embedText, streamGroundedAnswer } from '../services/ai.service.js';
import { databaseOrRespond, getUserId, isValidUuid } from '../utils/request.js';

export async function answerQuestion(request: Request, response: Response) {
  const db = databaseOrRespond(pool, response);
  if (!db) return;
  const { documentId, question, conversationId } = request.body ?? {};
  if (!isValidUuid(documentId) || typeof question !== 'string' || !question.trim() || question.length > 4000) {
    response.status(400).json({ error: 'Choose a document and enter a question under 4,000 characters.' });
    return;
  }
  const ownerId = getUserId(request);

  try {
    const owned = await db.query<{ id: string; status: string }>(
      'SELECT id, status FROM documents WHERE id = $1 AND owner_id = $2', [documentId, ownerId],
    );
    if (!owned.rows[0]) {
      response.status(404).json({ error: 'Document not found.' });
      return;
    }
    if (owned.rows[0].status !== 'ready') {
      response.status(409).json({ error: 'This document is not ready to chat yet.' });
      return;
    }

    const vector = await embedText(question.trim(), 'query');
    const matches = await db.query<{ id: string; page_number: number; content: string }>(`
      SELECT id, page_number, content
      FROM chunks
      WHERE owner_id = $2 AND document_id = $3 AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT 5
    `, [`[${vector.join(',')}]`, ownerId, documentId]);
    if (matches.rowCount === 0) {
      response.status(409).json({ error: 'No searchable text was found for this document.' });
      return;
    }

    const activeConversationId = await getOrCreateConversation(db, {
      conversationId,
      ownerId,
      documentId,
      title: question.trim().slice(0, 80),
    });
    const history = await db.query<{ role: 'user' | 'assistant'; content: string }>(
      'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 8',
      [activeConversationId],
    );
    history.rows.reverse();
    await db.query('INSERT INTO messages (conversation_id, role, content) VALUES ($1, \'user\', $2)', [activeConversationId, question.trim()]);

    const citations = matches.rows.map((match, index) => ({
      id: match.id,
      number: index + 1,
      page: match.page_number,
      excerpt: match.content.slice(0, 520),
    }));
    const sourceText = matches.rows.map((match, index) => `[${index + 1}] Page ${match.page_number}: ${match.content}`).join('\n\n');
    const recentConversation = history.rows.map((message) => `${message.role === 'user' ? 'Student' : 'Assistant'}: ${message.content}`).join('\n');
    const prompt = [
      'You are a careful study assistant. Answer the student\'s latest question using only the source passages below.',
      'Use conversation history only to understand follow-up references. Cite factual claims inline using the exact citation markers [1], [2], etc.',
      'If the sources do not answer the question, say so plainly. Do not invent details or citations.',
      recentConversation ? `RECENT CONVERSATION\n${recentConversation}` : '',
      `SOURCE PASSAGES\n${sourceText}`,
      `LATEST QUESTION\n${question.trim()}`,
    ].filter(Boolean).join('\n\n');

    await streamAnswer(response, db, activeConversationId, prompt, citations);
  } catch (error) {
    console.error('Chat request failed:', error);
    if (!response.headersSent) response.status(502).json({ error: error instanceof Error ? error.message : 'Could not answer that question.' });
  }
}

async function getOrCreateConversation(
  db: NonNullable<typeof pool>,
  options: { conversationId: unknown; ownerId: string; documentId: string; title: string },
): Promise<string> {
  if (isValidUuid(options.conversationId)) {
    const existing = await db.query<{ id: string }>(
      'SELECT id FROM conversations WHERE id = $1 AND owner_id = $2 AND document_id = $3',
      [options.conversationId, options.ownerId, options.documentId],
    );
    if (existing.rows[0]) return existing.rows[0].id;
  }
  const created = await db.query<{ id: string }>(
    'INSERT INTO conversations (owner_id, document_id, title) VALUES ($1, $2, $3) RETURNING id',
    [options.ownerId, options.documentId, options.title],
  );
  return created.rows[0].id;
}

async function streamAnswer(
  response: Response,
  db: NonNullable<typeof pool>,
  conversationId: string,
  prompt: string,
  citations: Array<{ id: string; number: number; page: number; excerpt: string }>,
) {
  response.status(200);
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.flushHeaders();
  const sendEvent = (event: string, data: unknown) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const answer = await streamGroundedAnswer(prompt, (text) => sendEvent('token', { text }));
    await db.query('INSERT INTO messages (conversation_id, role, content, citations) VALUES ($1, \'assistant\', $2, $3::jsonb)', [conversationId, answer, JSON.stringify(citations)]);
    await db.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);
    sendEvent('done', { conversationId, citations });
  } catch (error) {
    console.error('Chat generation failed:', error);
    sendEvent('error', { message: 'The AI provider could not finish this answer. Please try again.' });
  } finally {
    response.end();
  }
}
