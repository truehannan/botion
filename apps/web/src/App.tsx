import { useEffect, useState } from 'react';
import { AuthPage } from './components/AuthPage';
import { Layout } from './components/Layout';
import { useAuthStore } from './stores/authStore';
import { useUIStore } from './stores/uiStore';
import { api } from './lib/api';

function App() {
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const user = useAuthStore((s) => s.user);
  const setActiveWorkspaceId = useUIStore((s) => s.setActiveWorkspaceId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      if (token) {
        try {
          const res = await api.auth.me();
          if (res.user) {
            setAuth(token, res.user);
            // Load first workspace
            const ws = await api.workspaces.list();
            if (ws.workspaces?.length > 0) {
              setActiveWorkspaceId(ws.workspaces[0].id);
            }
          }
        } catch {
          // Token invalid, ignore
        }
      }
      setLoading(false);
    }
    init();
  }, [token, setAuth, setActiveWorkspaceId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-neutral-400">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <Layout />;
}

export default App;
