import { create } from 'zustand';

export interface Property {
  id: string; database_id: string; name: string; type: string;
  config: Record<string, any>; sort_order: number;
}

export interface ViewDef {
  id: string; database_id: string;
  type: 'table' | 'board' | 'gallery' | 'list' | 'calendar' | 'timeline';
  name: string; config: Record<string, any>; sort_order: number;
}

export interface DatabaseRow {
  id: string; workspace_id: string; title: string;
  icon?: string | null; is_folder: boolean;
  properties: Record<string, any>;
}

interface Database { id: string; parent_page_id: string; name: string; properties: Property[]; views: ViewDef[]; }

interface DatabaseState {
  databases: Database[];
  activeDatabaseId: string | null;
  properties: Property[];
  views: ViewDef[];
  rows: DatabaseRow[];
  setDatabases: (dbs: Database[]) => void;
  setActiveDatabase: (id: string | null) => void;
  setProperties: (props: Property[]) => void;
  setViews: (views: ViewDef[]) => void;
  setRows: (rows: DatabaseRow[]) => void;
  addRow: (row: DatabaseRow) => void;
  updateRowProperty: (rowId: string, propId: string, value: any) => void;
}

export const useDatabaseStore = create<DatabaseState>((set) => ({
  databases: [], activeDatabaseId: null, properties: [], views: [], rows: [],
  setDatabases: (dbs) => set({ databases: dbs }),
  setActiveDatabase: (id) => set({ activeDatabaseId: id }),
  setProperties: (props) => set({ properties: props }),
  setViews: (views) => set({ views }),
  setRows: (rows) => set({ rows }),
  addRow: (row) => set((s) => ({ rows: [...s.rows, row] })),
  updateRowProperty: (rowId, propId, value) =>
    set((s) => ({
      rows: s.rows.map((r) =>
        r.id === rowId ? { ...r, properties: { ...r.properties, [propId]: value } } : r
      ),
    })),
}));
