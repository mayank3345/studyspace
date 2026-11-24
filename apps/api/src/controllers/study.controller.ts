import type { Request, Response } from 'express';
import { pool } from '../config/database.js';
import { generateStudyItems } from '../services/ai.service.js';
import { databaseOrRespond, getUserId, isValidUuid } from '../utils/request.js';

type GeneratedItem = { prompt?: string; answer?: string; sourcePages?: number[] };

export async function listStudyItems(request: Request, response: Response) {
  const db = databaseOrRespond(pool, response);
  if (!db) return;
  if (!isValidUuid(request.params.id)) {
    response.status(400).json({ error: 'Invalid document ID.' });
    return;
  }
  const result = await db.query(`
    SELECT id, item_type AS type, prompt, answer, source_pages AS "sourcePages", created_at AS "createdAt"
    FROM study_items WHERE document_id = $1 AND owner_id = $2 ORDER BY created_at DESC
  `, [request.params.id, getUserId(request)]);
  response.json({ items: result.rows });
}

export async function createStudyItems(request: Request, response: Response) {
  const db = databaseOrRespond(pool, response);
  if (!db) return;
  if (!isValidUuid(request.params.id)) {
    response.status(400).json({ error: 'Invalid document ID.' });
    return;
  }
  const type = request.body?.type === 'quiz' ? 'quiz' : request.body?.type === 'flashcard' ? 'flashcard' : null;
  const count = Number(request.body?.count ?? 8);
  if (!type || !Number.isInteger(count) || count < 1 || count > 12) {
    response.status(400).json({ error: 'Choose flashcards or quiz and a count from 1 to 12.' });
    return;
  }

  try {
    const document = await db.query<{ filename: string }>(
      "SELECT filename FROM documents WHERE id = $1 AND owner_id = $2 AND status = 'ready'",
      [request.params.id, getUserId(request)],
    );
    if (!document.rows[0]) {
      response.status(404).json({ error: 'Ready document not found.' });
      return;
    }
    const chunks = await db.query<{ page_number: number; content: string }>(
      'SELECT page_number, content FROM chunks WHERE document_id = $1 AND owner_id = $2 ORDER BY page_number, chunk_index LIMIT 80',
      [request.params.id, getUserId(request)],
    );
    const sourceText = chunks.rows.map((item) => `[Page ${item.page_number}] ${item.content}`).join('\n\n').slice(0, 65000);
    const itemDescription = type === 'flashcard'
      ? 'clear, atomic study flashcards'
      : 'multiple-choice quiz questions with the correct answer and a brief explanation';
    const prompt = `Create exactly ${count} ${itemDescription} using only the supplied document excerpts. Return JSON only in this shape: {"items":[{"prompt":"...","answer":"...","sourcePages":[1]}]}. sourcePages must contain integer page numbers from the excerpts. Do not invent facts.\n\nDOCUMENT: ${document.rows[0].filename}\n\nEXCERPTS:\n${sourceText}`;
    const raw = await generateStudyItems(prompt);
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '')) as { items?: GeneratedItem[] };
    const items = (parsed.items ?? [])
      .filter((item) => typeof item.prompt === 'string' && typeof item.answer === 'string')
      .slice(0, count);
    if (!items.length) throw new Error('The AI provider returned no usable study items.');

    const saved = [];
    for (const item of items) {
      const pages = Array.isArray(item.sourcePages)
        ? [...new Set(item.sourcePages.filter((page) => Number.isInteger(page) && page > 0))]
        : [];
      const inserted = await db.query(`
        INSERT INTO study_items (owner_id, document_id, item_type, prompt, answer, source_pages)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, item_type AS type, prompt, answer, source_pages AS "sourcePages"
      `, [getUserId(request), request.params.id, type, item.prompt!.slice(0, 1200), item.answer!.slice(0, 4000), pages]);
      saved.push(inserted.rows[0]);
    }
    response.status(201).json({ items: saved });
  } catch (error) {
    console.error('Study material generation failed:', error);
    response.status(502).json({ error: error instanceof Error ? error.message : 'Could not generate study materials.' });
  }
}
