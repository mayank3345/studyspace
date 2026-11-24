# AI Document Q&A & Study Workspace

A starter monorepo for a document study app using React, Express, TypeScript, Neon Postgres, and pgvector.

## Prerequisites

- Node.js 20 or newer
- npm
- A Neon Postgres project

## 1. Configure Neon

Create a project and database in Neon. Copy the connection string from the Neon dashboard. In the repository root, run `cp .env.example .env`, then set `DATABASE_URL` to that connection string. Keep `.env` private; it is ignored by Git.

Create an API key in the [Groq Console](https://console.groq.com/keys) and set `GROQ_API_KEY` in `.env`. Chat and study-item generation use Groq's `openai/gpt-oss-20b` model by default. Groq provides a free developer tier with model-specific rate limits; check the [current limits](https://console.groq.com/docs/rate-limits) before relying on it. Groq API usage is subject to its own data policies.

Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey) and set `GEMINI_API_KEY` in `.env`. Gemini is used only for document and question embeddings, using `gemini-embedding-2` at 1,536 dimensions to match the Neon `vector(1536)` column. Google's free-tier requests may be used to improve its products, so avoid sensitive PDFs. See [Gemini API pricing and data use](https://ai.google.dev/gemini-api/docs/pricing/) and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

In the Neon SQL Editor, run [`db/schema.sql`](db/schema.sql). If you already ran the earlier starter schema, run [`db/migrations/002_rag_features.sql`](db/migrations/002_rag_features.sql) instead. It adds PDF byte storage, login sessions, and an HNSW vector index. The schema uses 1,536-dimensional vectors to match the configured Gemini embedding output. Gemini Embedding 2 supports this output size; keep `GEMINI_EMBEDDING_DIMENSIONS`, the embedding request, and the database vector column in sync.

## 2. Install and run

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). The API runs on `http://localhost:3001`.

## API routes

- `GET /api/health` — confirms the API is running.
- `GET /api/health/db` — checks the Neon connection and returns the database time.
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` — session-based authentication.
- `GET /api/documents`, `POST /api/documents`, `DELETE /api/documents/:id`, `GET /api/documents/:id/file` — user-scoped PDF library and PDF retrieval.
- `POST /api/chat` — retrieve relevant chunks using Gemini embeddings and stream a grounded Groq answer and citations over SSE.
- `GET/POST /api/documents/:id/study-items` — load and generate flashcards or quiz questions.

## Current MVP limits

- Uploads are limited to 20 MB, 100 pages, and 120 text chunks per PDF.
- PDFs must contain selectable text. OCR for scanned documents is not included.
- PDF bytes are stored in Neon Postgres for this portfolio MVP. For larger deployments, move PDF files to object storage.
- Selected PDF excerpts are sent to Groq for answer/study generation, and document/query text is sent to Google for embeddings. Review both providers' data policies and avoid uploading sensitive documents.

## Project layout

```text
apps/
  api/
    src/
      app.ts               Express middleware, health checks, and route mounting
      server.ts            Environment loading, listener, and shutdown
      config/              Neon pool and shared upload limits
      controllers/         HTTP handlers for auth, documents, chat, and study
      middleware/          Session auth and centralized errors
      routes/              URL-to-controller mappings
      services/            PDF ingestion, extraction, Gemini embeddings, and Groq generation
      utils/                Password/session crypto and request helpers
  web/
    src/
      App.tsx              Route map
      auth/                Session context and auth state
      components/          Reusable UI and workspace layout
      hooks/               Page-level state hooks
      lib/api.ts           Frontend-to-API requests and SSE parsing
      pages/               Login, register, library, chat, and study pages
      workspace/           Shared document workspace context
db/
  migrations/              Existing database migrations
  schema.sql               Initial Neon schema
```

## Frontend workflow

1. `main.tsx` installs the router and `AuthProvider`.
2. `App.tsx` maps URLs to login/register routes or the authenticated workspace.
3. `WorkspaceLayout` loads the user's documents and provides shared state to its nested pages.
4. `DocumentSidebar` owns the upload and delete interactions; the workspace pages focus on one task each.
5. Page components call the API functions in `lib/api.ts`; reusable UI such as the source viewer and chat message are in `components/`.

The core document flow is: `DocumentSidebar` uploads a PDF → `POST /api/documents` extracts pages and stores embedded chunks → `ChatPage` calls `POST /api/chat` → `lib/api.ts` reads streamed answer events → `ChatMessage` presents the answer and citation links. `StudyPage` requests and displays generated study items separately.

## Backend workflow

1. `server.ts` loads the root `.env`, then creates the Express app and Neon pool.
2. `app.ts` installs shared middleware and mounts each route group.
3. Route modules attach session middleware and connect URLs to a controller.
4. Controllers validate input and coordinate database work with services.
5. Services perform PDF extraction/chunking, Gemini embedding calls, Groq generation, and document ingestion; request helpers keep ownership and ID checks consistent.

For example, PDF upload follows `routes/documents.routes.ts` → `controllers/documents.controller.ts` → `services/document-ingestion.service.ts` → `services/pdf.service.ts` and `services/ai.service.ts` → Neon.

Keep provider API keys on the API server; never expose them through Vite environment variables.
