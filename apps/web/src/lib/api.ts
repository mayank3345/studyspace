import type { Citation, DocumentItem, Message, StudyItem, User } from '../types';

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? 'Something went wrong.');
  return body as T;
}

export async function request<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return parseResponse<T>(await fetch(path, { ...init, headers }));
}

export async function authenticate(mode: 'login' | 'register', email: string, password: string) {
  return parseResponse<{ token: string; user: User }>(await fetch(`/api/auth/${mode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }));
}

export function listDocuments(token: string) {
  return request<{ documents: DocumentItem[] }>(token, '/api/documents');
}

export async function uploadDocument(token: string, file: File) {
  const form = new FormData();
  form.append('pdf', file);
  return request<{ document: DocumentItem }>(token, '/api/documents', { method: 'POST', body: form });
}

export function deleteDocument(token: string, documentId: string) {
  return request<{ ok: boolean }>(token, `/api/documents/${documentId}`, { method: 'DELETE' });
}

export function listStudyItems(token: string, documentId: string) {
  return request<{ items: StudyItem[] }>(token, `/api/documents/${documentId}/study-items`);
}

export function createStudyItems(token: string, documentId: string, type: StudyItem['type'], count = 8) {
  return request<{ items: StudyItem[] }>(token, `/api/documents/${documentId}/study-items`, {
    method: 'POST', body: JSON.stringify({ type, count }),
  });
}

export async function loadPdf(token: string, documentId: string): Promise<string> {
  const response = await fetch(`/api/documents/${documentId}/file`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Could not open the source PDF.');
  return URL.createObjectURL(await response.blob());
}

type StreamChatOptions = {
  token: string;
  documentId: string;
  question: string;
  conversationId?: string;
  onToken: (text: string) => void;
  onComplete: (conversationId: string, citations: Citation[]) => void;
};

export async function streamChat(options: StreamChatOptions): Promise<void> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.token}` },
    body: JSON.stringify({
      documentId: options.documentId,
      question: options.question,
      conversationId: options.conversationId || undefined,
    }),
  });
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? 'Could not start the answer stream.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  const handleEvent = (block: string) => {
    const eventName = block.split('\n').find((line) => line.startsWith('event:'))?.slice(6).trim();
    const data = block.split('\n').find((line) => line.startsWith('data:'))?.slice(5).trim();
    if (!data) return;
    const payload = JSON.parse(data);
    if (eventName === 'token') options.onToken(payload.text);
    if (eventName === 'done') options.onComplete(payload.conversationId, payload.citations);
    if (eventName === 'error') throw new Error(payload.message ?? 'The answer stream failed.');
  };

  while (true) {
    const { value, done } = await reader.read();
    pending = (pending + decoder.decode(value, { stream: !done })).replace(/\r\n/g, '\n');
    const events = pending.split('\n\n');
    pending = events.pop() ?? '';
    events.forEach(handleEvent);
    if (done) {
      if (pending.trim()) handleEvent(pending);
      break;
    }
  }
}
