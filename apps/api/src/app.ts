import cors from 'cors';
import express from 'express';
import { pool } from './config/database.js';
import { configuredChatModel, configuredChatProvider, configuredEmbeddingModel, configuredEmbeddingProvider } from './services/ai.service.js';
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import documentRoutes from './routes/documents.routes.js';
import { errorMiddleware } from './middleware/error.middleware.js';

export function createApp() {
  const app = express();
  const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

  app.use(cors({ origin: clientOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', service: 'api', chatProvider: configuredChatProvider, chatModel: configuredChatModel, embeddingProvider: configuredEmbeddingProvider, embeddingModel: configuredEmbeddingModel });
  });

  app.get('/api/health/db', async (_request, response) => {
    if (!pool) {
      response.status(503).json({ error: 'DATABASE_URL is not configured.' });
      return;
    }
    try {
      const result = await pool.query<{ now: string; vector_enabled: boolean }>(`
        SELECT NOW() AS now,
               EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS vector_enabled
      `);
      response.json({ status: 'ok', databaseTime: result.rows[0]?.now, pgvectorEnabled: result.rows[0]?.vector_enabled });
    } catch (error) {
      console.error('Database health check failed:', error);
      response.status(503).json({ error: 'Could not connect to Neon.' });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/chat', chatRoutes);
  app.use(errorMiddleware);

  return app;
}
