import { create } from 'zustand';

interface PageNode { id: string; title: string; is_folder: boolean; parent_id?: string | null; icon?: string | null; }

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  selectedPageId: string | null;
  setSelectedPageId: (id: string | null) => void;
  inlineAIOpen: boolean;
  setInlineAIOpen: (open: boolean) => void;
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  pages: PageNode[];
  setPages: (pages: PageNode[]) => void;
  addPage: (page: PageNode) => void;
  removePage: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  selectedPageId: null,
  setSelectedPageId: (id) => set({ selectedPageId: id }),
  inlineAIOpen: false,
  setInlineAIOpen: (open) => set({ inlineAIOpen: open }),
  activeWorkspaceId: null,
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
  pages: [],
  setPages: (pages) => set({ pages }),
  addPage: (page) => set((s) => ({ pages: [...s.pages, page] })),
  removePage: (id) => set((s) => ({ pages: s.pages.filter((p) => p.id !== id) })),
}));
