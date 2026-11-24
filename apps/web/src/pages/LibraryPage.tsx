import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../workspace/WorkspaceContext';

export default function LibraryPage() {
  const { documents } = useWorkspace();
  const navigate = useNavigate();
  const firstDocument = documents[0];

  if (firstDocument) {
    return (
      <div className="welcome empty-welcome">
        <div className="eyebrow"><span className="spark">✳</span> PICK UP WHERE YOU LEFT OFF</div>
        <h1>Your notes,<br /><em>ready when you are.</em></h1>
        <p>Choose a document from your library to ask questions or study.</p>
        <button className="primary-btn" onClick={() => navigate(`/documents/${firstDocument.id}/chat`)}>Open {firstDocument.filename} <span>↗</span></button>
      </div>
    );
  }

  return (
    <div className="welcome empty-welcome">
      <div className="eyebrow"><span className="spark">✳</span> A CLEARER WAY TO STUDY</div>
      <h1>Make your notes<br /><em>work for you.</em></h1>
      <p>Upload a lecture note or reading to begin asking questions.</p>
      <div className="upload-guidance">Use a selectable-text PDF · Up to 20 MB and 100 pages · Scanned PDFs need OCR</div>
    </div>
  );
}
