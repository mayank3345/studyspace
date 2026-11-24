import type { Message } from '../types';

export default function ChatMessage({ message, onOpenPage }: { message: Message; onOpenPage: (page: number) => void }) {
  return (
    <article className={`message ${message.role}`}>
      {message.role === 'assistant' && <span className="assistant-mark mini">✳</span>}
      <div className="message-body">
        <div className="message-label">{message.role === 'user' ? 'YOU' : 'STUDYSPACE'}</div>
        <div className="message-content">
          {message.content || <span className="typing-dots">Thinking<span>.</span><span>.</span><span>.</span></span>}
        </div>
        {Boolean(message.citations?.length) && <div className="citation-list">
          <div className="citation-label">SOURCES FROM YOUR DOCUMENT</div>
          {message.citations?.map((citation) => (
            <button key={citation.id} className="citation-card" onClick={() => onOpenPage(citation.page)}>
              <span className="citation-page">P.{citation.page}</span><span>{citation.excerpt}</span><span className="citation-open">↗</span>
            </button>
          ))}
        </div>}
      </div>
    </article>
  );
}
