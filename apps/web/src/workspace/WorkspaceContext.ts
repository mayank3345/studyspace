import { useOutletContext } from 'react-router-dom';
import type { DocumentItem } from '../types';

export type WorkspaceContextValue = {
  documents: DocumentItem[];
  documentsLoading: boolean;
  selectedDocument?: DocumentItem;
  token: string;
  error: string;
  setError: (message: string) => void;
  sourcePage: number | null;
  openSourcePage: (page: number) => Promise<void>;
  closeSourcePage: () => void;
};

export function useWorkspace() {
  return useOutletContext<WorkspaceContextValue>();
}
