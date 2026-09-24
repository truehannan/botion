import { Logo } from './Logo';
import { setMode } from '@/lib/mode';
import { HardDrive, Cloud } from 'lucide-react';

/**
 * First-launch screen for native apps: choose how Botion runs.
 *  - Local:   no account, data stays on this device (uses localApi).
 *  - Connect: talk to a Cloudflare-hosted Botion server (URL + login).
 */
export function ModeChooser({ onChosen }: { onChosen: () => void }) {
  const choose = (mode: 'local' | 'connect') => {
    setMode(mode);
    onChosen();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="mb-8 flex items-center gap-3">
        <Logo className="h-10 w-10 text-neutral-900 dark:text-neutral-100" />
        <span className="text-2xl font-semibold tracking-tight dark:text-white">Botion</span>
      </div>

      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
        <button
          onClick={() => choose('local')}
          className="group flex flex-col items-start gap-3 rounded-xl border border-neutral-200 bg-white p-6 text-left transition hover:border-neutral-400 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600"
        >
          <HardDrive className="h-7 w-7 text-neutral-700 dark:text-neutral-300" />
          <div className="text-base font-semibold dark:text-white">Use locally</div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No account needed. Your notes stay on this device. Works fully offline.
          </p>
        </button>

        <button
          onClick={() => choose('connect')}
          className="group flex flex-col items-start gap-3 rounded-xl border border-neutral-200 bg-white p-6 text-left transition hover:border-neutral-400 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600"
        >
          <Cloud className="h-7 w-7 text-neutral-700 dark:text-neutral-300" />
          <div className="text-base font-semibold dark:text-white">Connect to server</div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Sign in to a Cloudflare-hosted Botion. Sync across devices with your account.
          </p>
        </button>
      </div>

      <p className="mt-6 text-xs text-neutral-400">You can switch modes later from settings.</p>
    </div>
  );
}
