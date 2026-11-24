import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { createStudyItems, listStudyItems } from '../lib/api';
import type { StudyItem } from '../types';
import DocumentHeading from '../components/DocumentHeading';
import QuizQuestion from '../components/QuizQuestion';
import { useWorkspace } from '../workspace/WorkspaceContext';

export default function StudyPage() {
  const { documentId = '' } = useParams();
  const { selectedDocument, documents, documentsLoading, token, setError, openSourcePage } = useWorkspace();
  const document = selectedDocument?.id === documentId ? selectedDocument : documents.find((item) => item.id === documentId);
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<StudyItem[]>([]);
  const [type, setType] = useState<StudyItem['type']>(searchParams.get('type') === 'quiz' ? 'quiz' : 'flashcard');
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const currentItems = useMemo(() => items.filter((item) => item.type === type), [items, type]);
  const currentItem = currentItems[cardIndex];

  useEffect(() => {
    if (!documentId) return;
    listStudyItems(token, documentId)
      .then(({ items: saved }) => setItems(saved))
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load study material.'));
  }, [documentId, token, setError]);

  async function generate(typeToGenerate = type) {
    if (!document || loading) return;
    setType(typeToGenerate); setLoading(true); setRevealed(false); setError('');
    try {
      const result = await createStudyItems(token, document.id, typeToGenerate, 8);
      setItems((current) => [...result.items, ...current]);
      setCardIndex(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create study material.');
    } finally { setLoading(false); }
  }

  function changeType(nextType: StudyItem['type']) {
    setType(nextType); setCardIndex(0); setRevealed(false);
  }

  function nextCard() {
    if (!currentItems.length) return;
    setCardIndex((index) => (index + 1) % currentItems.length);
    setRevealed(false);
  }

  if (!document) return <div className="page-loading">{documentsLoading ? 'Loading document…' : <span>This document is not in your library. <Link to="/app">Back to your library</Link></span>}</div>;

  return <>
    <DocumentHeading document={document} />
    <div className="study-workspace">
      <div className="study-intro"><div className="eyebrow"><span className="spark">✳</span> ACTIVE RECALL</div><h2>Learn it by remembering it.</h2><p>Generate flashcards or choose quiz options to check what you know.</p></div>
      <div className="study-controls">
        <button className={type === 'flashcard' ? 'active' : ''} onClick={() => changeType('flashcard')}>Flashcards</button>
        <button className={type === 'quiz' ? 'active' : ''} onClick={() => changeType('quiz')}>Quiz</button>
        <button className="generate-btn" disabled={loading || document.status !== 'ready'} onClick={() => void generate()}>{loading ? 'Creating…' : `Generate ${type === 'flashcard' ? 'flashcards' : 'quiz'}`}</button>
      </div>
      {currentItem ? <div className="flashcard-wrap">
        <div className="flashcard">
          <div className="flashcard-top"><span>{type === 'flashcard' ? 'FLASHCARD' : 'QUIZ QUESTION'}</span><span>{cardIndex + 1} / {currentItems.length}</span></div>
          <div className="flashcard-prompt">{currentItem.prompt}</div>
          {type === 'quiz' && currentItem.options.length >= 2
            ? <QuizQuestion key={currentItem.id} item={currentItem} token={token} documentId={document.id} onOpenSource={openSourcePage} />
            : revealed
              ? <div className="flashcard-answer"><div className="section-kicker">ANSWER</div><p>{currentItem.answer ?? 'No answer is available for this saved item.'}</p><button className="citation-inline" onClick={() => void openSourcePage(currentItem.sourcePages[0] ?? 1)}>Source page {currentItem.sourcePages.join(', ') || '—'} ↗</button></div>
              : <button className="reveal-btn" onClick={() => setRevealed(true)}>Reveal answer <span>↓</span></button>}
        </div>
        <button className="next-card" onClick={nextCard}>Next card <span>→</span></button>
      </div> : <div className="study-empty"><span className="empty-symbol">✳</span><strong>No {type === 'flashcard' ? 'flashcards' : 'quiz questions'} yet</strong><p>Generate a set of eight based on this document.</p><button className="primary-btn" disabled={loading || document.status !== 'ready'} onClick={() => void generate()}>{loading ? 'Creating…' : `Create ${type === 'flashcard' ? 'flashcards' : 'quiz questions'}`} <span>↗</span></button></div>}
    </div>
  </>;
}
