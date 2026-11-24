import { NavLink } from 'react-router-dom';
import type { DocumentItem } from '../types';

export default function DocumentHeading({ document }: { document: DocumentItem }) {
  return (
    <div className="document-heading">
      <div className="doc-title">
        <span className="pdf-badge large">PDF</span>
        <div>
          <div className="section-kicker">{document.status === 'ready' ? `${document.pageCount ?? '—'} PAGES · ${document.chunkCount} SEARCHABLE SECTIONS` : document.status.toUpperCase()}</div>
          <h2>{document.filename}</h2>
        </div>
      </div>
      <nav className="tab-switch" aria-label="Document workspace">
        <NavLink to={`/documents/${document.id}/chat`}>Ask</NavLink>
        <NavLink to={`/documents/${document.id}/study`}>Study</NavLink>
      </nav>
    </div>
  );
}
