import { useEffect, useState } from 'react';
import { AuthPage } from './components/AuthPage';
import { NativeAuthScreen } from './components/NativeAuthScreen';
import { ModeChooser } from './components/ModeChooser';
import { UpdateBanner } from './components/UpdateBanner';
import { Layout } from './components/Layout';
import { useAuthStore } from './stores/authStore';
import { useUIStore } from './stores/uiStore';
import { api } from './lib/api';
import { isTauri, getMode, isLocalMode } from './lib/mode';

function App() {
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const user = useAuthStore((s) => s.user);
  const setActiveWorkspaceId = useUIStore((s) => s.setActiveWorkspaceId);
  const [loading, setLoading] = useState(true);
  // Re-render when the native mode is chosen.
  const [mode, setModeState] = useState(getMode());

  useEffect(() => {
    async function init() {
      // Local mode needs no login — seed a synthetic user and load workspaces.
      if (isLocalMode()) {
        const me = await api.auth.me();
        setAuth('local', me.user);
        const ws = await api.workspaces.list();
        if (ws.workspaces?.length > 0) setActiveWorkspaceId(ws.workspaces[0].id);
        setLoading(false);
        return;
      }
      if (token) {
        try {
          const res = await api.auth.me();
          if (res.user) {
            setAuth(token, res.user);
            const ws = await api.workspaces.list();
            if (ws.workspaces?.length > 0) {
              setActiveWorkspaceId(ws.workspaces[0].id);
            }
          }
        } catch {}
      }
      setLoading(false);
    }
    init();
  }, [token, mode, setAuth, setActiveWorkspaceId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-neutral-400">
        Loading...
      </div>
    );
  }

  // Native app: first launch must pick a mode (local vs connect to server).
  if (isTauri() && !getMode()) {
    return <ModeChooser onChosen={() => setModeState(getMode())} />;
  }

  let screen;
  if (!user) {
    screen = isTauri() ? <NativeAuthScreen onBack={() => setModeState(getMode())} /> : <AuthPage />;
  } else {
    screen = <Layout />;
  }

  return (
    <div className="flex h-screen flex-col">
      <UpdateBanner />
      <div className="min-h-0 flex-1">{screen}</div>
    </div>
  );
}

export default App;
