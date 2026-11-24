import type { Request, Response } from 'express';
import { pool } from '../config/database.js';
import { ingestPdf } from '../services/document-ingestion.service.js';
import { databaseOrRespond, getUserId, isValidUuid } from '../utils/request.js';

export async function listDocuments(request: Request, response: Response) {
  const db = databaseOrRespond(pool, response);
  if (!db) return;
  try {
    const result = await db.query(`
      SELECT d.id, d.filename, d.status, d.page_count AS "pageCount", d.processing_error AS "processingError", d.created_at AS "createdAt",
             (SELECT COUNT(*)::int FROM chunks c WHERE c.document_id = d.id) AS "chunkCount"
      FROM documents d WHERE d.owner_id = $1 ORDER BY d.created_at DESC
    `, [getUserId(request)]);
    response.json({ documents: result.rows });
  } catch (error) {
    console.error('Could not list documents:', error);
    response.status(500).json({ error: 'Could not load documents.' });
  }
}

export async function uploadDocument(request: Request, response: Response) {
  const db = databaseOrRespond(pool, response);
  if (!db) return;
  const file = request.file;
  if (!file) {
    response.status(400).json({ error: 'Choose a PDF file to upload.' });
    return;
  }
  if (!file.originalname.toLowerCase().endsWith('.pdf') || file.buffer.subarray(0, 5).toString() !== '%PDF-') {
    response.status(400).json({ error: 'The selected file is not a valid PDF.' });
    return;
  }
  try {
    const document = await ingestPdf(db, getUserId(request), file);
    response.status(201).json({ document });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF processing failed.';
    console.error('PDF ingestion failed:', message);
    response.status(422).json({ error: message });
  }
}

export async function getPdf(request: Request, response: Response) {
  const db = databaseOrRespond(pool, response);
  if (!db) return;
  if (!isValidUuid(request.params.id)) {
    response.status(400).json({ error: 'Invalid document ID.' });
    return;
  }
  const result = await db.query<{ filename: string; file_data: Buffer }>(
    'SELECT filename, file_data FROM documents WHERE id = $1 AND owner_id = $2',
    [request.params.id, getUserId(request)],
  );
  const document = result.rows[0];
  if (!document?.file_data) {
    response.status(404).json({ error: 'PDF not found.' });
    return;
  }
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(document.filename)}`);
  response.setHeader('Cache-Control', 'private, no-store');
  response.send(document.file_data);
}

export async function deleteDocument(request: Request, response: Response) {
  const db = databaseOrRespond(pool, response);
  if (!db) return;
  if (!isValidUuid(request.params.id)) {
    response.status(400).json({ error: 'Invalid document ID.' });
    return;
  }
  const result = await db.query('DELETE FROM documents WHERE id = $1 AND owner_id = $2', [request.params.id, getUserId(request)]);
  if (!result.rowCount) {
    response.status(404).json({ error: 'Document not found.' });
    return;
  }
  response.json({ ok: true });
}

