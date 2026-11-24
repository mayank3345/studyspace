import { useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { deleteDocument, uploadDocument } from '../lib/api';
import type { DocumentItem } from '../types';

type Props = {
  documents: DocumentItem[];
  selectedId?: string;
  onUploaded: (document: DocumentItem) => Promise<void>;
  onDeleted: (documentId: string) => Promise<void>;
  onError: (message: string) => void;
};

export default function DocumentSidebar({ documents, selectedId, onUploaded, onDeleted, onError }: Props) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file?: File) {
    if (!file) return;
    setUploading(true); onError('');
    try {
      const { document } = await uploadDocument(token, file);
      await onUploaded(document);
      navigate(`/documents/${document.id}/chat`);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Could not upload this PDF.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function handleDelete(documentId: string, filename: string) {
    if (!window.confirm(`Delete “${filename}” and its study data?`)) return;
    try {
      await deleteDocument(token, documentId);
      await onDeleted(documentId);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Could not delete this document.');
    }
  }

  return (
    <aside className="library-panel">
      <div className="panel-heading">
        <div><div className="section-kicker">YOUR LIBRARY</div><h2>Documents</h2></div>
        <span className="count">{documents.length} FILE{documents.length === 1 ? '' : 'S'}</span>
      </div>
      <input
        ref={fileInput}
        className="visually-hidden"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <button className="upload-small" type="button" disabled={uploading} onClick={() => fileInput.current?.click()}>
        <span>{uploading ? '…' : '↑'}</span>{uploading ? 'Processing PDF…' : 'Add a PDF'}
      </button>

      <div className="document-list">
        {documents.map((document) => (
          <div key={document.id} className={`document-row ${selectedId === document.id ? 'selected' : ''}`}>
            <NavLink className="document-select" to={`/documents/${document.id}/chat`}>
              <span className="pdf-badge">PDF</span>
              <span className="document-name">{document.filename}<small>{document.status === 'ready' ? `${document.pageCount ?? '—'} pages · ${document.chunkCount} sections` : document.status}</small></span>
            </NavLink>
            <button className="delete-doc" onClick={() => void handleDelete(document.id, document.filename)} aria-label={`Delete ${document.filename}`}>×</button>
          </div>
        ))}
        {documents.length === 0 && <div className="library-empty"><span className="empty-symbol">▤</span><p>Your library is waiting.</p><small>Add a PDF to begin a study session.</small></div>}
      </div>
      <div className="library-note"><span>✳</span> Documents are account-scoped here. Text is sent to Groq for AI responses and Google for embeddings; avoid sensitive PDFs.</div>
    </aside>
  );
}
