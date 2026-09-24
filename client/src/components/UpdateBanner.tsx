import { useEffect, useState } from 'react';
import { isTauri } from '@/lib/mode';
import { Download, X, Loader2 } from 'lucide-react';

/**
 * Small "update available" banner shown at the top — apps only.
 * Checks GitHub Releases (via the Tauri updater plugin + latest.json) on mount,
 * and lets the user download+install, then relaunches. On web builds this
 * renders nothing (the web app updates itself on reload).
 */
export function UpdateBanner() {
  const [version, setVersion] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [state, setState] = useState<'idle' | 'downloading' | 'error'>('idle');
  const [dismissed, setDismissed] = useState(false);
  // Keep the pending update object without pulling the type into web builds.
  const [pending, setPending] = useState<any>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    (async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (!cancelled && update) {
          setPending(update);
          setVersion(update.version);
          setNotes(update.body ?? '');
        }
      } catch {
        // No update / updater unavailable — stay silent.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!version || dismissed) return null;

  const doUpdate = async () => {
    if (!pending) return;
    setState('downloading');
    try {
      await pending.downloadAndInstall();
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch {
      setState('error');
    }
  };

  return (
    <div className="flex items-center justify-center gap-3 bg-neutral-900 px-4 py-2 text-xs text-white dark:bg-neutral-100 dark:text-neutral-900">
      <span>
        A new version <strong>v{version}</strong> of Botion is available
        {state === 'error' ? ' — update failed, try again.' : notes ? ` — ${notes.slice(0, 80)}` : '.'}
      </span>
      <button
        onClick={doUpdate}
        disabled={state === 'downloading'}
        className="inline-flex items-center gap-1 rounded bg-white/15 px-2 py-1 font-medium hover:bg-white/25 disabled:opacity-60 dark:bg-black/10 dark:hover:bg-black/20"
      >
        {state === 'downloading'
          ? <><Loader2 className="h-3 w-3 animate-spin" /> Updating…</>
          : <><Download className="h-3 w-3" /> Update now</>}
      </button>
      <button onClick={() => setDismissed(true)} className="opacity-70 hover:opacity-100" aria-label="Dismiss">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
