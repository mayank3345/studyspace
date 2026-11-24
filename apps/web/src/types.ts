export type User = { id: string; email: string };

export type DocumentItem = {
  id: string;
  filename: string;
  status: 'uploaded' | 'processing' | 'ready' | 'failed';
  pageCount: number | null;
  chunkCount: number;
  processingError?: string;
};

export type Citation = { id: string; number: number; page: number; excerpt: string };

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
};

export type StudyItem = {
  id: string;
  type: 'flashcard' | 'quiz';
  prompt: string;
  answer: string;
  sourcePages: number[];
};
