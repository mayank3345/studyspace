import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { streamChat } from '../lib/api';
import type { Message } from '../types';
import ChatMessage from '../components/ChatMessage';
import DocumentHeading from '../components/DocumentHeading';
import QuestionComposer from '../components/QuestionComposer';
import { useChatSession } from '../hooks/useChatSession';
import { useWorkspace } from '../workspace/WorkspaceContext';

export default function ChatPage() {
  const { documentId = '' } = useParams();
  const { selectedDocument, documents, documentsLoading, token, setError, openSourcePage } = useWorkspace();
  const document = selectedDocument?.id === documentId ? selectedDocument : documents.find((item) => item.id === documentId);
  const [session, setSession] = useChatSession(documentId);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [session.messages]);

  async function ask(question: string) {
    if (!document || loading) return;
    setError(''); setLoading(true);
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: question };
    const assistantId = crypto.randomUUID();
    setSession((current) => ({
      ...current,
      messages: [...current.messages, userMessage, { id: assistantId, role: 'assistant', content: '' }],
    }));
    try {
      await streamChat({
        token,
        documentId: document.id,
        question,
        conversationId: session.conversationId,
        onToken: (text) => setSession((current) => ({
          ...current,
          messages: current.messages.map((message) => message.id === assistantId ? { ...message, content: message.content + text } : message),
        })),
        onComplete: (conversationId, citations) => setSession((current) => ({
          conversationId,
          messages: current.messages.map((message) => message.id === assistantId ? { ...message, citations } : message),
        })),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not answer that question.');
      setSession((current) => ({ ...current, messages: current.messages.filter((message) => message.id !== assistantId) }));
    } finally { setLoading(false); }
  }

  if (!document) return <div className="page-loading">{documentsLoading ? 'Loading document…' : <span>This document is not in your library. <Link to="/app">Back to your library</Link></span>}</div>;

  return <>
    <DocumentHeading document={document} />
    <div className="chat-workspace">
      <div className="chat-intro"><span className="assistant-mark">✳</span><div><strong>Ask your document</strong><p>Answers are grounded in your PDF, with page references you can open.</p></div></div>
      <div className="suggestion-row">
        <button onClick={() => void ask('Summarize the main ideas in this document.')}>Summarize the main ideas</button>
        <button onClick={() => void ask('What are the key terms I should know?')}>List key terms</button>
      </div>
      <div className="message-list">
        {session.messages.length === 0 && <div className="chat-empty"><span>“</span><p>What would you like to understand?</p><small>Try a question about a concept, a definition, or a specific page.</small></div>}
        {session.messages.map((message) => <ChatMessage key={message.id} message={message} onOpenPage={(page) => void openSourcePage(page)} />)}
        <div ref={bottomRef} />
      </div>
      <QuestionComposer disabled={document.status !== 'ready' || loading} onSend={ask} />
    </div>
  </>;
}
