# Project Changes

## Project setup

- Created an npm workspaces monorepo for the AI Document Q&A & Study Workspace.
- Added a React + TypeScript + Vite frontend in `apps/web`.
- Added an Express + TypeScript API in `apps/api`.
- Added shared root scripts to run the frontend and API together with `npm run dev`, and build both with `npm run build`.
- Added `.gitignore` rules for secrets, dependencies, build output, local cache, uploads, and TypeScript build metadata.
- Installed npm dependencies and generated `package-lock.json`.
- Added `pdfjs-dist` for text extraction and `multer` for bounded in-memory PDF uploads.

## Frontend

- Added registration/sign-in, a user-scoped PDF library, upload, streamed Q&A, clickable citation/page viewing, and flashcard/quiz study views.
- Split the frontend into route pages, reusable components, an auth context, a workspace context, API helpers, and a chat-session hook.
- Added React Router routes for `/login`, `/register`, `/app`, `/documents/:id/chat`, and `/documents/:id/study`.
- Persisted in-progress chat state per document for the browser session so switching between Chat and Study does not discard the current thread.
- Added an in-product notice about the Gemini free tier's content handling and the current upload limits.
- Configured Vite to proxy `/api` requests to the Express API on port 3001.

## API

- Split the API into a server bootstrap, Express app, configuration, route groups, controllers, middleware, services, and request/auth utilities.
- Moved environment loading into `server.ts` so database and Gemini modules are imported only after the root `.env` is loaded.
- Added `GET /api/health` to report API status.
- Added `GET /api/health/db` to check the Neon connection and report whether pgvector is enabled.
- Configured the API to load the shared root `.env` file.
- Added CORS and JSON request handling.
- Added email/password registration and login with scrypt password hashes and opaque, hashed 30-day sessions.
- Added authenticated document listing, PDF upload, PDF retrieval, and document deletion routes.
- Added page-aware PDF extraction, overlapping chunking, Gemini embeddings, and Neon persistence.
- Added owner/document-filtered pgvector retrieval, conversation persistence, SSE Gemini responses, and citation metadata.
- Added Gemini-generated flashcard and quiz creation with persisted source page references.

## Neon database

- Added `db/schema.sql` to enable pgvector and create tables for users, documents, chunks, conversations, messages, and study items.
- Configured the chunk embedding column as `VECTOR(1536)` and an HNSW cosine index.
- Added indexes for document and user ownership lookup.
- Added an idempotent migration for existing Neon projects to add PDF byte storage, auth sessions, and the HNSW cosine vector index.
- Applied the migration to the configured Neon database.
- Updated the development startup so Vite waits for the API to listen on port 3001, and pinned the local API/proxy connection to IPv4 loopback to avoid localhost address-family mismatches.

## Gemini configuration

- Updated `.env.example` with Gemini settings:
  - `AI_PROVIDER=gemini`
  - `GEMINI_CHAT_MODEL=gemini-3.8-flash`
  - `GEMINI_EMBEDDING_MODEL=gemini-embedding-2`
  - `GEMINI_EMBEDDING_DIMENSIONS=1536`
- Added README setup notes for creating a Gemini API key and configuring Neon.
- Added notes about free-tier quotas, vector dimension matching, and keeping API keys server-side.

## Documentation

- Documented the frontend and backend folder structure and the request flow in the README.
- Added this change log.

## Build status

- `npm run build` completed successfully for both the API and frontend.
- Confirmed that the Gemini chat and embedding model endpoints are available for the configured API key.
- Confirmed the Neon database connection, pgvector extension, all seven schema tables, and the `vector(1536)` embedding column.
- Added Gemini model defaults to the local `.env` where they were missing, while preserving the existing database URL and API key.

## Known limits and next improvements

- Scanned-PDF OCR, multi-document chat, conversation-history browsing, background ingestion jobs, and deployment are not included.
- PDFs are stored as PostgreSQL `BYTEA` for the MVP; move them to object storage for a larger deployment.
- The local `.env` contains the Neon connection string and Gemini API key; it remains ignored by Git.
- The development command now waits for the API before launching Vite; the Vite proxy and API use IPv4 loopback.

## AI provider update: Groq generation + Gemini embeddings

- Replaced Gemini chat and study-material generation with Groq's OpenAI-compatible streaming chat endpoint.
- Kept Gemini embeddings unchanged for ingestion and question retrieval, preserving the existing `vector(1536)` data in Neon; no re-embedding or database migration is needed.
- Added `GROQ_API_KEY` and `GROQ_CHAT_MODEL` configuration, defaulting to `openai/gpt-oss-20b`.
- Renamed the mixed provider module to `apps/api/src/services/ai.service.ts` and updated API health output to identify the chat and embedding providers separately.
- Updated the workspace privacy notice and README to explain that document text goes to Google for embeddings and relevant excerpts go to Groq for generation.
- The local `.env` needs a Groq API key from the Groq Console before chat/study generation will work. Keep the existing Gemini key for embeddings.

## Free deployment preparation

- Added a Render Blueprint in `render.yaml` for a free Node web service with secret environment variables configured through the Render dashboard.
- Configured the production Express app to serve the built Vite frontend alongside `/api` from one same-origin service.
- Updated the server listener to bind on all interfaces and added a root `start:prod` script for hosted runtime startup.
- Updated the Render build command to install dev dependencies explicitly, since TypeScript and type declarations are needed during the production build.
- Documented the deploy flow and current free-tier constraints: Render cold starts, ephemeral local filesystem, Neon storage/compute allowances, and Groq API rate limits.

## Groq free-tier context limits

- Reduced chat retrieval from five to four chunks and limited each source excerpt to 1,500 characters.
- Limited follow-up context to four prior messages with each message clipped to 350 characters.
- Reduced the maximum chat response to 900 tokens.
- Limited study generation context to 12 evenly sampled excerpts (650 characters each) across the document and capped its response at 2,400 tokens.
- These bounds keep prompts within a safer budget for Groq's 8,000 TPM free-tier model while retaining page-level source citations and document-wide study coverage.
