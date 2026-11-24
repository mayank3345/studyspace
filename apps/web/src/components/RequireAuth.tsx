import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function RequireAuth() {
  const { token, user, loading } = useAuth();
  if (loading) return <main className="auth-shell"><div className="auth-card"><span className="brand-mark">S</span><p>Opening your study desk…</p></div></main>;
  return token && user ? <Outlet /> : <Navigate to="/login" replace />;
}
