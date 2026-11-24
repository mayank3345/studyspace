import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import DocumentSidebar from './DocumentSidebar';
import ErrorNotice from './ErrorNotice';
import SourcePanel from './SourcePanel';
import { listDocuments, loadPdf } from '../lib/api';
import type { DocumentItem } from '../types';
import type { WorkspaceContextValue } from '../workspace/WorkspaceContext';

export default function WorkspaceLayout() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const documentRoute = useMatch('/documents/:documentId/*');
  const selectedId = documentRoute?.params.documentId;
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [sourcePage, setSourcePage] = useState<number | null>(null);
  const [pdfAsset, setPdfAsset] = useState<{ documentId: string; url: string } | null>(null);
  const [error, setError] = useState('');

  const selectedDocument = documents.find((document) => document.id === selectedId);

  useEffect(() => {
    let active = true;
    listDocuments(token)
      .then(({ documents: loaded }) => { if (active) setDocuments(loaded); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load your documents.'); })
      .finally(() => { if (active) setDocumentsLoading(false); })
    return () => { active = false; };
  }, [token]);

  useEffect(() => { setSourcePage(null); }, [selectedId]);
  useEffect(() => () => { if (pdfAsset) URL.revokeObjectURL(pdfAsset.url); }, [pdfAsset]);

  async function openSourcePage(page: number) {
    if (!selectedDocument) return;
    setSourcePage(page);
    setError('');
    if (pdfAsset?.documentId === selectedDocument.id) return;
    try {
      const url = await loadPdf(token, selectedDocument.id);
      setPdfAsset({ documentId: selectedDocument.id, url });
    } catch (cause) {
      setSourcePage(null);
      setError(cause instanceof Error ? cause.message : 'Could not open the PDF.');
    }
  }

  async function handleUploaded(document: DocumentItem) {
    setDocuments((current) => [document, ...current.filter((item) => item.id !== document.id)]);
    setError('');
  }

  async function handleDeleted(documentId: string) {
    setDocuments((current) => current.filter((document) => document.id !== documentId));
    setError('');
    if (selectedId === documentId) navigate('/app');
  }

  const workspaceValue = useMemo<WorkspaceContextValue>(() => ({
    documents,
    documentsLoading,
    selectedDocument,
    token,
    error,
    setError,
    sourcePage,
    openSourcePage,
    closeSourcePage: () => setSourcePage(null),
  }), [documents, documentsLoading, selectedDocument, token, error, sourcePage, pdfAsset]);

  const visiblePdfUrl = pdfAsset && pdfAsset.documentId === selectedDocument?.id ? pdfAsset.url : '';

  return (
    <main className="app-shell">
      <header className="topbar app-topbar">
        <Link className="brand" to="/app" aria-label="Studyspace home"><span className="brand-mark">S</span> studyspace</Link>
        <span className="topbar-note">YOUR PERSONAL LEARNING DESK</span>
        <div className="account-menu">
          <span className="user-email">{user?.email}</span>
          <button className="avatar" onClick={() => void logout()} title="Sign out">{user?.email.slice(0, 1).toUpperCase()}</button>
        </div>
      </header>

      <div className="app-layout">
        <DocumentSidebar
          documents={documents}
          selectedId={selectedId}
          onUploaded={handleUploaded}
          onDeleted={handleDeleted}
          onError={setError}
        />
        <section className="study-panel">
          <ErrorNotice message={error} onDismiss={() => setError('')} />
          <Outlet context={workspaceValue} />
        </section>
        <SourcePanel
          document={selectedDocument}
          page={sourcePage}
          pdfUrl={visiblePdfUrl}
          onClose={() => setSourcePage(null)}
        />
      </div>

      <footer className="statusbar"><span className="status-dot online" /><span>API connected</span><span className="divider">·</span><span>Neon + Groq + Gemini</span><span className="footer-right">BUILT FOR FOCUS <span>✳</span></span></footer>
    </main>
  );
}
