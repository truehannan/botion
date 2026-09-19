import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { Logo } from './Logo';
import { Server, LogIn } from 'lucide-react';

export function NativeAuthScreen() {
  const [serverUrl, setServerUrl] = useState('https://api.botion.app');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      localStorage.setItem('botion_server_url', serverUrl);
      const res = await fetch(`${serverUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) throw new Error('Login failed');
      const data = await res.json();
      setAuth(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Connection failed. Check your server URL and credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="mb-8 flex items-center gap-3">
        <Logo className="h-10 w-10 text-neutral-900 dark:text-neutral-100" />
        <span className="text-2xl font-semibold tracking-tight dark:text-white">Botion</span>
      </div>

      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm dark:bg-neutral-900">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          <Server className="h-4 w-4" />
          Connect to Server
        </div>

        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Server URL</label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              required
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {loading ? 'Connecting...' : <><LogIn className="h-4 w-4" /> Connect</>}
          </button>
        </form>
      </div>
    </div>
  );
}
