import { useAuthStore } from '@/stores/authStore';
import { localApi } from './localApi';
import { isLocalMode } from './mode';

function getBaseUrl(): string {
  const native = localStorage.getItem('botion_server_url');
  if (native) {
    const clean = native.endsWith('/') ? native.slice(0, -1) : native;
    // The Worker mounts the API under /api; append it if not already present.
    return clean.endsWith('/api') ? clean : `${clean}/api`;
  }
  const prod = import.meta.env.VITE_API_URL;
  if (prod) {
    return prod.endsWith('/') ? prod.slice(0, -1) : prod;
  }
  return '/api';
}

async function fetchApi(path: string, options?: RequestInit) {
  const token = useAuthStore.getState().token;
  const base = getBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(options?.headers ?? {}),
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

const remoteApi = {
  auth: {
    login: (email: string, password: string) =>
      fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (email: string, password: string, name?: string) =>
      fetchApi('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
    me: () => fetchApi('/auth/me'),
  },
  workspaces: {
    list: () => fetchApi('/workspaces'),
    get: (id: string) => fetchApi(`/workspaces/${id}`),
    create: (data: { name: string; slug: string }) =>
      fetchApi('/workspaces', { method: 'POST', body: JSON.stringify(data) }),
  },
  pages: {
    list: (workspaceId: string, parentId?: string | null) => {
      const params = new URLSearchParams({ workspace_id: workspaceId });
      if (parentId !== undefined) params.set('parent_id', parentId ?? 'null');
      return fetchApi(`/pages?${params}`);
    },
    get: (id: string) => fetchApi(`/pages/${id}`),
    create: (data: { workspace_id: string; parent_id?: string | null; title?: string; is_folder?: boolean }) =>
      fetchApi('/pages', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchApi(`/pages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi(`/pages/${id}`, { method: 'DELETE' }),
  },
  sync: {
    post: (pageId: string, body: { blocks: any[]; title?: string; workspaceId?: string }) =>
      fetchApi(`/sync/${pageId}`, { method: 'POST', body: JSON.stringify(body) }),
    get: (pageId: string) => fetchApi(`/sync/${pageId}`),
  },
  mcp: {
    chat: (messages: any[], workspaceId: string) =>
      fetchApi('/mcp/chat', { method: 'POST', body: JSON.stringify({ messages, workspaceId }) }),
  },
  backlinks: {
    list: (targetPageId: string) => fetchApi(`/backlinks?target_page_id=${targetPageId}`),
    create: (data: any) => fetchApi('/backlinks', { method: 'POST', body: JSON.stringify(data) }),
  },
  databases: {
    list: (parentPageId: string) => fetchApi(`/databases?parent_page_id=${parentPageId}`),
    create: (data: any) => fetchApi('/databases', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi(`/databases/${id}`, { method: 'DELETE' }),
  },
  properties: {
    create: (data: any) => fetchApi('/properties', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchApi(`/properties/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi(`/properties/${id}`, { method: 'DELETE' }),
  },
  propertyValues: {
    list: (pageIds: string[]) => {
      const params = new URLSearchParams();
      pageIds.forEach((id) => params.append('page_id', id));
      return fetchApi(`/property-values?${params}`);
    },
    upsert: (data: any) => fetchApi('/property-values', { method: 'POST', body: JSON.stringify(data) }),
  },
  views: {
    create: (data: any) => fetchApi('/views', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchApi(`/views/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi(`/views/${id}`, { method: 'DELETE' }),
  },
  settings: {
    get: () => fetchApi('/settings'),
    update: (data: any) => fetchApi('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
};

// The active API: local (device storage, no server) or remote (Cloudflare).
// Chosen per-call so a mode switch takes effect without reload.
export const api: typeof remoteApi = new Proxy(remoteApi, {
  get(target, group: string) {
    const backend: any = isLocalMode() ? localApi : target;
    return backend[group];
  },
}) as typeof remoteApi;
