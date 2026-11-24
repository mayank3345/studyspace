const groqApiKey = process.env.GROQ_API_KEY;
const groqChatModel = process.env.GROQ_CHAT_MODEL ?? 'openai/gpt-oss-20b';
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiEmbeddingModel = process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-2';
const geminiEmbeddingDimensions = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS ?? 1536);
const geminiApiBase = 'https://generativelanguage.googleapis.com/v1beta/models';
const groqApiBase = 'https://api.groq.com/openai/v1';
const retryableStatuses = new Set([429, 500, 502, 503, 504]);

function retryDelay(response: Response | undefined, retry: number): number {
  const retryAfter = response?.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const dateDelay = Number.isNaN(seconds) ? Date.parse(retryAfter) - Date.now() : seconds * 1000;
    if (Number.isFinite(dateDelay) && dateDelay > 0) return Math.min(dateDelay, 5000);
  }
  return Math.min(500 * (2 ** retry) + Math.random() * 250, 5000);
}

async function waitBeforeRetry(response: Response | undefined, retry: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, retryDelay(response, retry)));
}

function requireGeminiApiKey(): string {
  if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured (required for embeddings).');
  return geminiApiKey;
}

function requireGroqApiKey(): string {
  if (!groqApiKey) throw new Error('GROQ_API_KEY is not configured (required for chat and study generation).');
  return groqApiKey;
}

async function parseProviderResponse(response: Response, provider: string): Promise<any> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message ?? body?.error ?? `${provider} request failed (${response.status}).`;
    throw new Error(typeof message === 'string' ? message : `${provider} request failed (${response.status}).`);
  }
  return body;
}

export async function embedText(text: string, kind: 'document' | 'query'): Promise<number[]> {
  const content = kind === 'query'
    ? `task: question answering | query: ${text}`
    : `title: none | text: ${text}`;
  const response = await fetch(`${geminiApiBase}/${geminiEmbeddingModel}:embedContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': requireGeminiApiKey() },
    body: JSON.stringify({
      content: { parts: [{ text: content }] },
      outputDimensionality: geminiEmbeddingDimensions,
    }),
  });
  const body = await parseProviderResponse(response, 'Gemini embeddings');
  const values = body?.embedding?.values;
  if (!Array.isArray(values) || values.length !== geminiEmbeddingDimensions) {
    throw new Error(`Gemini returned an unexpected embedding size (expected ${geminiEmbeddingDimensions}).`);
  }
  return values as number[];
}

async function requestGroq(prompt: string, stream: boolean): Promise<Response> {
  const request: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${requireGroqApiKey()}` },
    body: JSON.stringify({
      model: groqChatModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: stream ? 0.2 : 0.3,
      max_tokens: stream ? 1200 : 4096,
      ...(stream ? { stream: true } : { response_format: { type: 'json_object' } }),
    }),
  };

  let response: Response | undefined;
  // Retry temporary provider errors only before a response stream has started.
  for (let retry = 0; retry <= 3; retry += 1) {
    response = await fetch(`${groqApiBase}/chat/completions`, request);
    if (response.ok || !retryableStatuses.has(response.status) || retry === 3) break;
    await waitBeforeRetry(response, retry);
  }
  if (!response) throw new Error('Groq did not return a response.');
  return response;
}

export async function generateStudyItems(prompt: string): Promise<string> {
  const response = await requestGroq(prompt, false);
  const body = await parseProviderResponse(response, 'Groq');
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Groq returned no study material.');
  return content;
}

export async function streamGroundedAnswer(
  prompt: string,
  onText: (text: string) => void,
): Promise<string> {
  const response = await requestGroq(prompt, true);
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({}));
    const message = body?.error?.message ?? `Groq request failed (${response.status}).`;
    throw new Error(typeof message === 'string' ? message : `Groq request failed (${response.status}).`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let answer = '';
  const consumeEvent = (event: string) => {
    const data = event.split('\n').find((line) => line.startsWith('data:'))?.slice(5).trim();
    if (!data || data === '[DONE]') return;
    const body = JSON.parse(data);
    const text = body?.choices?.[0]?.delta?.content;
    if (typeof text === 'string' && text) {
      answer += text;
      onText(text);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    pending = (pending + decoder.decode(value, { stream: !done })).replace(/\r\n/g, '\n');
    const events = pending.split('\n\n');
    pending = events.pop() ?? '';
    events.forEach(consumeEvent);
    if (done) { if (pending.trim()) consumeEvent(pending); break; }
  }
  return answer;
}

export const configuredChatProvider = 'groq';
export const configuredChatModel = groqChatModel;
export const configuredEmbeddingProvider = 'gemini';
export const configuredEmbeddingModel = geminiEmbeddingModel;
