import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Load the shared root env before importing modules that read model/database settings.
dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const { createApp } = await import('./app.js');
const { pool } = await import('./config/database.js');

const port = Number(process.env.PORT ?? 3001);
const server = createApp().listen(port, '127.0.0.1', () => {
  console.log(`API listening on http://127.0.0.1:${port}`);
});

server.on('error', (error) => {
  console.error(`Could not start API on port ${port}:`, error);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void pool?.end().finally(() => process.exit(0));
    });
  });
}
