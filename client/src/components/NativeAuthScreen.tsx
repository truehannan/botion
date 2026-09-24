import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Logo } from './Logo';
import { setServerUrl, clearMode } from '@/lib/mode';
import { Server, LogIn, ArrowLeft, Link2 } from 'lucide-react';

export function NativeAuthScreen({ onBack }: { onBack?: () => void }) {
  const [serverUrl, setServerUrlState] = useState('https://api.botion.app');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setAuth = useAuthStore((s) => s.setAuth);

  const base = () => (serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      setServerUrl(base());
      const res = await fetch(`${base()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Login failed');
      }
      const data = await res.json();
      setAuth(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  // Programmatic login by URL: fetch GET /api/auth/login-url once to obtain a
  // token. Useful for scripted/one-shot sign-in against a known server.
  const handleLoginByUrl = async () => {
    setError('');
    setLoading(true);
    try {
      setServerUrl(base());
      const url = `${base()}/api/auth/login-url?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Login failed');
      }
      const data = await res.json();
      setAuth(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Login by URL failed');
    } finally {
      setLoading(false);
    }
  };

  const back = () => {
    clearMode();
    onBack?.();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="mb-8 flex items-center gap-3">
        <Logo className="h-10 w-10 text-neutral-900 dark:text-neutral-100" />
        <span className="text-2xl font-semibold tracking-tight dark:text-white">Botion</span>
      </div>
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm dark:bg-neutral-900">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            <Server className="h-4 w-4" /> Connect to Server
          </div>
          {onBack && (
            <button onClick={back} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
          )}
        </div>
        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Server URL</label>
            <input type="url" value={serverUrl} onChange={(e) => setServerUrlState(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100" required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100" placeholder="you@example.com" required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100" placeholder="••••••••" required />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200">
            {loading ? 'Connecting...' : <><LogIn className="h-4 w-4" /> Connect</>}
          </button>
          <button type="button" onClick={handleLoginByUrl} disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-600 transition hover:border-neutral-400 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300">
            <Link2 className="h-3 w-3" /> Login by URL (programmatic)
          </button>
        </form>
      </div>
    </div>
  );
}
