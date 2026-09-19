import { useAuthStore } from '@/stores/authStore';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchApi(path: string, options?: RequestInit) {
  const token = useAuthStore.getState().token;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options?.headers ?? {}),
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
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
    update: (id: string, data: Partial<{ title: string; parent_id: string | null; icon: string; cover_image: string; sort_order: number }>) =>
      fetchApi(`/pages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi(`/pages/${id}`, { method: 'DELETE' }),
  },
  mcp: {
    chat: (messages: any[], workspaceId: string) =>
      fetchApi('/api/mcp/chat', { method: 'POST', body: JSON.stringify({ messages, workspaceId }) }),
  },
};
