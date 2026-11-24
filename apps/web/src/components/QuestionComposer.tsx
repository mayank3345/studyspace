import { useState, type FormEvent, type KeyboardEvent } from 'react';

export default function QuestionComposer({ disabled, onSend }: { disabled: boolean; onSend: (question: string) => Promise<void> }) {
  const [question, setQuestion] = useState('');

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const value = question.trim();
    if (!value || disabled) return;
    setQuestion('');
    await onSend(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form className="question-form" onSubmit={(event) => void submit(event)}>
      <textarea
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question about your document…"
        rows={2}
        disabled={disabled}
      />
      <button className="send-btn" disabled={!question.trim() || disabled} aria-label="Send question">↑</button>
      <div className="input-hint">Answers use only this document · Enter to send · Shift+Enter for a new line</div>
    </form>
  );
}
