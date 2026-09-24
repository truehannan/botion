// App run-mode: 'local' (standalone, no account, data in this device's storage)
// or 'connect' (talk to a Cloudflare-hosted Botion server with login).
//
// Web builds are always 'connect' (they are served by the server). Native
// (Tauri) builds let the user choose on first launch.

export type AppMode = 'local' | 'connect';

const MODE_KEY = 'botion_mode';
const SERVER_URL_KEY = 'botion_server_url';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI__;
}

export function getMode(): AppMode | null {
  // Non-native builds only ever run in connect mode against their origin.
  if (!isTauri()) return 'connect';
  const m = localStorage.getItem(MODE_KEY);
  return m === 'local' || m === 'connect' ? m : null;
}

export function setMode(mode: AppMode) {
  localStorage.setItem(MODE_KEY, mode);
}

export function clearMode() {
  localStorage.removeItem(MODE_KEY);
  localStorage.removeItem(SERVER_URL_KEY);
}

export function isLocalMode(): boolean {
  return getMode() === 'local';
}

export function getServerUrl(): string | null {
  return localStorage.getItem(SERVER_URL_KEY);
}

export function setServerUrl(url: string) {
  const clean = url.endsWith('/') ? url.slice(0, -1) : url;
  localStorage.setItem(SERVER_URL_KEY, clean);
}
