import type { Request, Response } from 'express';
import { pool } from '../config/database.js';
import { generateStudyItems } from '../services/ai.service.js';
import { databaseOrRespond, getUserId, isValidUuid } from '../utils/request.js';

type GeneratedItem = {
  prompt?: string;
  answer?: string;
  options?: unknown;
  correctOptionIndices?: unknown;
  sourcePages?: number[];
};

export async function listStudyItems(request: Request, response: Response) {
  const db = databaseOrRespond(pool, response);
  if (!db) return;
  if (!isValidUuid(request.params.id)) {
    response.status(400).json({ error: 'Invalid document ID.' });
    return;
  }
  const result = await db.query(`
    SELECT id, item_type AS type, prompt,
           CASE WHEN item_type = 'quiz' AND jsonb_array_length(options) > 0 THEN NULL ELSE answer END AS answer,
           options, source_pages AS "sourcePages", created_at AS "createdAt"
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
      'SELECT page_number, content FROM chunks WHERE document_id = $1 AND owner_id = $2 ORDER BY page_number, chunk_index LIMIT 120',
      [request.params.id, getUserId(request)],
    );
    const sampleCount = Math.min(12, chunks.rows.length);
    const sampledChunks = Array.from({ length: sampleCount }, (_, index) => {
      const sourceIndex = sampleCount === 1
        ? 0
        : Math.round(index * (chunks.rows.length - 1) / (sampleCount - 1));
      return chunks.rows[sourceIndex];
    });
    const sourceText = sampledChunks
      .map((item) => `[Page ${item.page_number}] ${item.content.slice(0, 650)}`)
      .join('\n\n');
    const itemDescription = type === 'flashcard'
      ? 'clear, atomic study flashcards'
      : 'multiple-choice quiz questions, each with exactly four distinct options and one or more correct options';
    const outputShape = type === 'flashcard'
      ? '{"items":[{"prompt":"...","answer":"...","sourcePages":[1]}]}'
      : '{"items":[{"prompt":"...","options":["option A","option B","option C","option D"],"correctOptionIndices":[0],"answer":"brief explanation","sourcePages":[1]}]}';
    const prompt = `Create exactly ${count} ${itemDescription} using only the supplied document excerpts. Return JSON only in this shape: ${outputShape}. Quiz correctOptionIndices are zero-based; options must be strings and the answer field is a brief explanation. sourcePages must contain integer page numbers from the excerpts. Do not invent facts.\n\nDOCUMENT: ${document.rows[0].filename}\n\nEXCERPTS:\n${sourceText}`;
    const raw = await generateStudyItems(prompt);
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '')) as { items?: GeneratedItem[] };
    const items = (parsed.items ?? []).filter((item) => {
      if (typeof item.prompt !== 'string' || typeof item.answer !== 'string') return false;
      if (type === 'flashcard') return true;
      const options = item.options;
      const correctOptionIndices = item.correctOptionIndices;
      if (!Array.isArray(options) || options.length !== 4 || !options.every((option) => typeof option === 'string')) return false;
      return Array.isArray(correctOptionIndices)
        && correctOptionIndices.length > 0
        && correctOptionIndices.every((index) => Number.isInteger(index) && index >= 0 && index < options.length);
    }).slice(0, count);
    if (!items.length) throw new Error('The AI provider returned no usable study items.');

    const saved = [];
    for (const item of items) {
      const pages = Array.isArray(item.sourcePages)
        ? [...new Set(item.sourcePages.filter((page) => Number.isInteger(page) && page > 0))]
        : [];
      const options = type === 'quiz' ? item.options as string[] : [];
      const correctOptions = type === 'quiz' ? item.correctOptionIndices as number[] : [];
      const inserted = await db.query(`
        INSERT INTO study_items (owner_id, document_id, item_type, prompt, answer, options, correct_option_indices, source_pages)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
        RETURNING id, item_type AS type, prompt, answer, options, source_pages AS "sourcePages"
      `, [getUserId(request), request.params.id, type, item.prompt!.slice(0, 1200), item.answer!.slice(0, 4000), JSON.stringify(options), correctOptions, pages]);
      if (type === 'quiz') inserted.rows[0].answer = null;
      saved.push(inserted.rows[0]);
    }
    response.status(201).json({ items: saved });
  } catch (error) {
    console.error('Study material generation failed:', error);
    response.status(502).json({ error: error instanceof Error ? error.message : 'Could not generate study materials.' });
  }
}

export async function checkStudyAnswer(request: Request, response: Response) {
  const db = databaseOrRespond(pool, response);
  if (!db) return;
  const { id: documentId, itemId } = request.params;
  if (!isValidUuid(documentId) || !isValidUuid(itemId)) {
    response.status(400).json({ error: 'Invalid document or quiz item ID.' });
    return;
  }
  const selected = request.body?.selectedOptionIndices;
  if (!Array.isArray(selected) || selected.length < 1 || selected.length > 4
      || !selected.every((index: unknown) => Number.isInteger(index) && (index as number) >= 0 && (index as number) < 4)) {
    response.status(400).json({ error: 'Select one or more answer options before checking.' });
    return;
  }

  const result = await db.query<{
    options: string[];
    correct_option_indices: number[];
    answer: string;
  }>(`
    SELECT options, correct_option_indices, answer
    FROM study_items
    WHERE id = $1 AND document_id = $2 AND owner_id = $3 AND item_type = 'quiz'
  `, [itemId, documentId, getUserId(request)]);
  const item = result.rows[0];
  if (!item || item.options.length < 2) {
    response.status(404).json({ error: 'Quiz item not found. Generate a new quiz to get selectable options.' });
    return;
  }

  const selectedIndices = [...new Set(selected as number[])].sort((a, b) => a - b);
  const correctIndices = [...item.correct_option_indices].sort((a, b) => a - b);
  const isCorrect = selectedIndices.length === correctIndices.length
    && selectedIndices.every((index, position) => index === correctIndices[position]);
  response.json({
    isCorrect,
    correctOptions: correctIndices.map((index) => item.options[index]).filter(Boolean),
    explanation: item.answer,
  });
}
