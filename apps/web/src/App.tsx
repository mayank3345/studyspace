import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import RequireAuth from './components/RequireAuth';
import RequireGuest from './components/RequireGuest';
import WorkspaceLayout from './components/WorkspaceLayout';
import ChatPage from './pages/ChatPage';
import LibraryPage from './pages/LibraryPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StudyPage from './pages/StudyPage';

function HomeRedirect() {
  const { token, user, loading } = useAuth();
  if (loading) return <main className="auth-shell"><div className="auth-card"><span className="brand-mark">S</span><p>Opening your study desk…</p></div></main>;
  return <Navigate to={token && user ? '/app' : '/login'} replace />;
}

export default function App() {
  return <Routes>
    <Route path="/" element={<HomeRedirect />} />
    <Route element={<RequireGuest />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
    </Route>
    <Route element={<RequireAuth />}>
      <Route element={<WorkspaceLayout />}>
        <Route path="/app" element={<LibraryPage />} />
        <Route path="/documents/:documentId/chat" element={<ChatPage />} />
        <Route path="/documents/:documentId/study" element={<StudyPage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
