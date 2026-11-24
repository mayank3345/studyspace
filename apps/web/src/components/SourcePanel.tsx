import { useNavigate } from 'react-router-dom';
import type { DocumentItem } from '../types';

type Props = {
  document?: DocumentItem;
  page: number | null;
  pdfUrl: string;
  onClose: () => void;
};

export default function SourcePanel({ document, page, pdfUrl, onClose }: Props) {
  const navigate = useNavigate();
  const isViewer = page !== null;

  return (
    <aside className={`source-panel ${isViewer ? 'is-viewer' : ''}`}>
      {isViewer ? <>
        <div className="source-head">
          <div><div className="section-kicker">DOCUMENT VIEWER</div><h3>Page {page}</h3></div>
          <button className="close-source" onClick={onClose} aria-label="Close document viewer">×</button>
        </div>
        {pdfUrl ? <iframe className="pdf-viewer" title="PDF source page" src={`${pdfUrl}#page=${page}&toolbar=0`} /> : <div className="pdf-loading">Opening source page…</div>}
      </> : <>
        <div className="section-kicker">STUDY TOOLS</div>
        <h3>Keep the ideas close.</h3>
        <p className="source-copy">Turn this document into a set you can return to later.</p>
        <button className="tool-card" disabled={!document || document.status !== 'ready'} onClick={() => document && navigate(`/documents/${document.id}/study?type=flashcard`)}>
          <span className="tool-icon">▤</span><span><strong>Make flashcards</strong><small>Definitions, concepts, key ideas</small></span><span className="tool-arrow">↗</span>
        </button>
        <button className="tool-card" disabled={!document || document.status !== 'ready'} onClick={() => document && navigate(`/documents/${document.id}/study?type=quiz`)}>
          <span className="tool-icon quiz-icon">✓</span><span><strong>Build a quiz</strong><small>Check what you remember</small></span><span className="tool-arrow">↗</span>
        </button>
        <div className="source-tip"><span>✳</span><p>Answers include page citations so you can revisit the original context.</p></div>
      </>}
    </aside>
  );
}
