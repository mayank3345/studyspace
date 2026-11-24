import type { ErrorRequestHandler } from 'express';
import multer from 'multer';

export const errorMiddleware: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      error: error.code === 'LIMIT_FILE_SIZE' ? 'PDF must be 20 MB or smaller.' : 'Upload one PDF at a time.',
    });
    return;
  }
  console.error('Unhandled API error:', error);
  response.status(500).json({ error: 'An unexpected server error occurred.' });
};
