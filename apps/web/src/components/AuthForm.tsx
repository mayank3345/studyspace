import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(''); setSubmitting(true);
    try {
      if (mode === 'register') await register(email, password);
      else await login(email, password);
      navigate('/app', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in.');
    } finally { setSubmitting(false); }
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <Link className="brand auth-brand" to="/"><span className="brand-mark">S</span> studyspace</Link>
        <div className="eyebrow"><span className="spark">✳</span> A CLEARER WAY TO STUDY</div>
        <h1>{mode === 'register' ? <>Make room<br /><em>to understand.</em></> : <>Welcome<br /><em>back.</em></>}</h1>
        <p className="auth-copy">Your documents, questions, and study notes in one calm workspace.</p>
        <label>Email address<input autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label>Password<input autoComplete={mode === 'register' ? 'new-password' : 'current-password'} type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
        {error && <p className="error-banner">{error}</p>}
        <button className="primary-btn full-btn" disabled={submitting}>{submitting ? 'One moment…' : mode === 'register' ? 'Create your account' : 'Sign in'}</button>
        <p className="auth-switch">{mode === 'register' ? 'Already have an account?' : 'New to Studyspace?'} <Link to={mode === 'register' ? '/login' : '/register'}>{mode === 'register' ? 'Sign in' : 'Create account'}</Link></p>
      </form>
    </main>
  );
}
