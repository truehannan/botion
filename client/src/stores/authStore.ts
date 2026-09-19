import { create } from 'zustand';

interface User { id: string; email: string; name?: string | null; }

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('botion_token'),
  user: null,
  setAuth: (token, user) => {
    localStorage.setItem('botion_token', token);
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('botion_token');
    set({ token: null, user: null });
  },
}));
