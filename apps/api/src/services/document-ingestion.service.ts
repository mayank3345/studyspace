import type { Express } from 'express';
import type { Pool } from 'pg';
import { uploadLimits } from '../config/limits.js';
import { configuredEmbeddingModel, embedText } from './ai.service.js';
import { chunkPage, extractPdfPages } from './pdf.service.js';

type CreatedDocument = {
  id: string;
  filename: string;
  status: 'ready';
  pageCount: number;
  chunkCount: number;
};

export async function ingestPdf(pool: Pool, ownerId: string, file: Express.Multer.File): Promise<CreatedDocument> {
  const created = await pool.query<{ id: string }>(`
    INSERT INTO documents (owner_id, filename, status, file_data)
    VALUES ($1, $2, 'processing', $3) RETURNING id
  `, [ownerId, file.originalname.slice(0, 255), file.buffer]);
  const documentId = created.rows[0].id;

  try {
    const extracted = await extractPdfPages(file.buffer);
    if (extracted.pageCount > uploadLimits.maxPdfPages) throw new Error(`This PDF has ${extracted.pageCount} pages. The current limit is ${uploadLimits.maxPdfPages}.`);
    if (extracted.pages.length === 0) throw new Error('No selectable text was found. Scanned PDFs need OCR, which is not enabled yet.');

    const sections = extracted.pages.flatMap((page) =>
      chunkPage(page.text, 2200, 240).map((content) => ({ pageNumber: page.pageNumber, content })),
    );
    if (sections.length > uploadLimits.maxChunks) throw new Error(`This PDF creates ${sections.length} text sections. The current limit is ${uploadLimits.maxChunks}; try a shorter document.`);

    const embedded: Array<{ pageNumber: number; index: number; content: string; vector: number[] }> = [];
    for (let index = 0; index < sections.length; index += 3) {
      const batch = sections.slice(index, index + 3);
      const vectors = await Promise.all(batch.map(({ content }) => embedText(content, 'document')));
      batch.forEach((section, batchIndex) => embedded.push({
        ...section,
        index: index + batchIndex,
        vector: vectors[batchIndex],
      }));
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const chunk of embedded) {
        await client.query(`
          INSERT INTO chunks (document_id, owner_id, page_number, chunk_index, content, embedding, embedding_model)
          VALUES ($1, $2, $3, $4, $5, $6::vector, $7)
        `, [documentId, ownerId, chunk.pageNumber, chunk.index, chunk.content, `[${chunk.vector.join(',')}]`, configuredEmbeddingModel]);
      }
      await client.query("UPDATE documents SET status = 'ready', page_count = $2, updated_at = NOW() WHERE id = $1", [documentId, extracted.pageCount]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return {
      id: documentId,
      filename: file.originalname,
      status: 'ready',
      pageCount: extracted.pageCount,
      chunkCount: embedded.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF processing failed.';
    await pool.query("UPDATE documents SET status = 'failed', processing_error = $2, updated_at = NOW() WHERE id = $1", [documentId, message.slice(0, 500)]).catch(() => undefined);
    await pool.query('DELETE FROM chunks WHERE document_id = $1', [documentId]).catch(() => undefined);
    throw error;
  }
}
