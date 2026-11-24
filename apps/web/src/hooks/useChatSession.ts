import { useEffect, useState } from 'react';
import type { Message } from '../types';

type ChatSession = { messages: Message[]; conversationId: string };

function readSession(key: string): ChatSession {
  try {
    const saved = sessionStorage.getItem(key);
    return saved ? JSON.parse(saved) as ChatSession : { messages: [], conversationId: '' };
  } catch {
    return { messages: [], conversationId: '' };
  }
}

export function useChatSession(documentId: string) {
  const storageKey = `studyspace.chat.${documentId}`;
  const [session, setSession] = useState<ChatSession>(() => readSession(storageKey));

  useEffect(() => { setSession(readSession(storageKey)); }, [storageKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => sessionStorage.setItem(storageKey, JSON.stringify(session)), 200);
    return () => window.clearTimeout(timer);
  }, [session, storageKey]);

  return [session, setSession] as const;
}
