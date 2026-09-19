import { useEffect, useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { Logo } from './Logo';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRightIcon,
  Search,
} from 'lucide-react';

interface PageNode {
  id: string;
  title: string;
  is_folder: boolean;
  parent_id?: string | null;
  icon?: string | null;
  children?: PageNode[];
}

function buildTree(pages: PageNode[]): PageNode[] {
  const map = new Map<string, PageNode>();
  const roots: PageNode[] = [];

  for (const p of pages) {
    map.set(p.id, { ...p, children: [] });
  }

  for (const p of pages) {
    const node = map.get(p.id)!;
    if (p.parent_id && map.has(p.parent_id)) {
      const parent = map.get(p.parent_id)!;
      if (!parent.children) parent.children = [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function PageItem({ page, depth = 0 }: { page: PageNode; depth?: number }) {
  const selectedPageId = useUIStore((s) => s.selectedPageId);
  const setSelectedPageId = useUIStore((s) => s.setSelectedPageId);
  const [expanded, setExpanded] = useState(true);
  const isSelected = selectedPageId === page.id;
  const hasChildren = page.children && page.children.length > 0;

  return (
    <div>
      <button
        onClick={() => {
          if (page.is_folder && hasChildren) {
            setExpanded((e) => !e);
          }
          setSelectedPageId(page.id);
        }}
        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm transition ${
          isSelected ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren && page.is_folder ? (
          <span className="text-neutral-400" onClick={(e) => { e.stopPropagation(); setExpanded((e) => !e); }}>
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
          </span>
        ) : (
          <span className="w-3.5" />
        )}

        {page.is_folder ? (
          expanded ? (
            <FolderOpen className="h-3.5 w-3.5 text-neutral-400" />
          ) : (
            <Folder className="h-3.5 w-3.5 text-neutral-400" />
          )
        ) : (
          <FileText className="h-3.5 w-3.5 text-neutral-400" />
        )}

        <span className="truncate">{page.title}</span>
      </button>

      {expanded && hasChildren && (
        <div>
          {page.children!.map((child) => (
            <PageItem key={child.id} page={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const activeWorkspaceId = useUIStore((s) => s.activeWorkspaceId);
  const pages = useUIStore((s) => s.pages);
  const setPages = useUIStore((s) => s.setPages);
  const addPage = useUIStore((s) => s.addPage);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const [workspaceName, setWorkspaceName] = useState('Workspace');

  useEffect(() => {
    if (!activeWorkspaceId) return;
    api.workspaces.get(activeWorkspaceId).then((res) => {
      if (res.workspace) setWorkspaceName(res.workspace.name);
    });
    api.pages.list(activeWorkspaceId, null).then((res) => {
      setPages(res.pages ?? []);
    });
  }, [activeWorkspaceId, setPages]);

  const handleNewPage = async () => {
    if (!activeWorkspaceId) return;
    const res = await api.pages.create({
      workspace_id: activeWorkspaceId,
      title: 'Untitled',
      parent_id: null,
      is_folder: false,
    });
    if (res.page) addPage(res.page);
  };

  const tree = buildTree(pages);

  return (
    <>
      <aside
        className={`flex flex-col border-r border-neutral-100 bg-white transition-all duration-200 ${
          sidebarOpen ? 'w-64 min-w-[16rem]' : 'w-0 overflow-hidden opacity-0'
        }`}
      >
        <div className="flex items-center gap-2 px-3 py-3">
          <Logo className="h-6 w-6 text-neutral-900" />
          <span className="flex-1 truncate text-sm font-semibold">{workspaceName}</span>
          <button onClick={toggleSidebar} className="rounded p-1 text-neutral-400 hover:bg-neutral-100">
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-3 mb-2 flex items-center gap-2 rounded-md bg-neutral-50 px-2 py-1.5 text-xs text-neutral-400">
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Search</span>
          <kbd className="rounded border border-neutral-200 bg-white px-1 font-mono text-[10px]">⌘K</kbd>
        </div>

        <div className="flex flex-1 flex-col gap-0.5 overflow-auto px-1 py-1">
          {tree.map((page) => (
            <PageItem key={page.id} page={page} />
          ))}
        </div>

        <div className="mt-auto border-t border-neutral-100 p-2">
          <button
            onClick={handleNewPage}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-50"
          >
            <Plus className="h-3.5 w-3.5" />
            New page
          </button>

          <div className="mt-1 flex items-center gap-2 rounded-md px-2 py-1.5">
            {user?.name ? (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-medium text-white">
                {user.name[0]?.toUpperCase()}
              </div>
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-[10px]">
                ?
              </div>
            )}
            <span className="flex-1 truncate text-xs text-neutral-600">{user?.email}</span>
            <button onClick={logout} className="rounded p-1 text-neutral-400 hover:bg-neutral-100">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed left-3 top-3 z-50 rounded-md border border-neutral-100 bg-white p-1.5 shadow-sm text-neutral-500 hover:text-neutral-900"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </>
  );
}
