{
  "system_context": {
    "project_name": "Botion",
    "description": "An edge-native, real-time collaborative workspace and Notion clone integrated with a system-level AI agent. Deployed fully on Cloudflare (Workers, D1, R2, DO) with native desktop and mobile binaries powered by Tauri v2.",
    "role": "You are an autonomous AI coding agent. Your goal is to strictly implement the architecture, schema, UI, and deployment pipelines detailed below. Execute systematically. Do not hallucinate external Node.js/PostgreSQL dependencies; stick strictly to Cloudflare V8 isolates and local SQLite for native apps."
  },
  "architecture_and_stack": {
    "frontend": "React 18 + Vite + TypeScript. State management via Zustand (local UI) and Yjs (CRDT collaborative state).",
    "editor": "BlockNote (Prosemirror/Tiptap) with custom React extensions for slash commands and blocks.",
    "backend": "Hono.js running on Cloudflare Workers. Real-time sync via Cloudflare Durable Objects + WebSocket Hibernation.",
    "database": "Cloudflare D1 (Serverless SQLite).",
    "storage": "Cloudflare R2 (Object storage).",
    "ai_layer": "Cloudflare Workers AI + Vectorize (RAG).",
    "native_wrapper": "Tauri v2 (Rust-based) for compiling Windows (.exe/.msi), macOS (.dmg/.app), Linux (.deb/.AppImage), and Android (.apk)."
  },
  "ui_ux_guidelines": {
    "aesthetic": "Extreme minimalism. Inspiration: Notion, Linear, Vercel.",
    "theme": "Dynamic Light/Dark mode via `next-themes` and Tailwind `dark:` variants.",
    "colors": "Monochrome primary palette. Backgrounds: `#FFFFFF` (Light), `#0A0A0A` (Dark). Borders should be invisible or extremely subtle (`border-border/40`). Rely heavily on negative space and padding for structural grouping.",
    "typography": "Inter or Geist for all UI elements. Newsreader (Serif) toggle available for long-form document reading.",
    "iconography": "Hugeicons Pro or Lucide-React. Stroke width strict at 1.5px. Icons must be monochrome, inheriting text color.",
    "page_elements": "Every document must support a full-width Banner/Cover image (fetched from R2 or Unsplash API) and a Page Icon (Hugeicons or Emoji) that syncs to the sidebar tree."
  },
  "core_feature_specifications": {
    "block_ecosystem": [
      "Standard text nodes (H1, H2, H3, paragraph, bulleted/numbered lists, quotes).",
      "Interactive blocks: Toggles (collapsible), Callouts (with custom background hues and icons).",
      "Technical blocks: Code blocks (with syntax highlighting), Math/LaTeX equation blocks.",
      "Layout blocks: Multi-column structural blocks.",
      "Embeds & Synced blocks: Pointers to other blocks that update globally."
    ],
    "database_and_views": [
      "Core DB Engine: A generic relational data structure where every 'row' is a Botion Page.",
      "Properties: Text, Number, Select, Multi-Select, Date, Checkbox, URL, Email, Person, Relation (two-way linking), Rollup, Formula, and AI Autofill.",
      "Table View: Dense spreadsheet layout, drag-to-resize columns, infinite scroll pagination.",
      "Board View (Kanban): Grouped by Select/Status properties, drag-and-drop cards between columns.",
      "Gallery View: Visual grid displaying page cover images or content previews.",
      "List View: Minimalist dense vertical index.",
      "Calendar & Timeline Views: Rendered based on Date properties."
    ],
    "linking_and_structure": [
      "Hierarchical Sidebar: Infinite nesting of pages inside pages. Implemented via a `parent_id` self-referencing column in D1. Supports drag-and-drop tree reordering.",
      "Page Mentions & Backlinks: Typing `@` opens a search modal to link pages. The target page auto-generates a 'Backlinks' footer.",
      "Auto-Save & Sync: CRDT payload streams over WebSockets via Yjs. Fallback to local IndexedDB (web) or Tauri FS (native) when offline."
    ]
  },
  "database_migrations_and_d1_ops": {
    "schema_design": "Strict SQLite schema with `Pages`, `Blocks`, `Databases`, `Properties`, and `Workspaces` tables.",
    "auto_migration_pipeline": [
      "Use Wrangler's built-in migration system: `wrangler d1 migrations apply botion-db`.",
      "Provide an automation script (`npm run db:sync`) that parses `schema.sql`, detects missing tables/columns, and auto-generates sequential migration `.sql` files to prevent conflict.",
      "Configuration: In `wrangler.toml`, bind the database using `database_name = \"botion-db\"` instead of hardcoding the `database_id`. Create a pre-build script that runs `wrangler d1 info botion-db` and provisions it if missing."
    ]
  },
  "multi_platform_deployment_tauri": {
    "strategy": "A single Vite/React codebase compiled for Web and Native using Tauri v2.",
    "native_auth_flow": [
      "When opening the Desktop/Mobile app, the user is presented with a Connection Screen.",
      "Inputs: `Server URL` (e.g., https://botion.mydomain.com) and `Auth Credentials` (Email/Password or API Key).",
      "Action: App pings `[Server_URL]/api/auth/verify`. On success, stores the JWT securely in Tauri's secure keystore and routes all subsequent requests/WebSockets to that custom Server URL."
    ],
    "build_targets": [
      "Windows: `.exe`, `.msi`",
      "macOS: `.dmg`, `.app` (Universal binary for Intel/Apple Silicon)",
      "Linux: `.deb`, `.AppImage`",
      "Android: `.apk`, `.aab`"
    ],
    "ci_cd_pipeline": "Provide a `.github/workflows/release.yml` that triggers on Git tags, runs `tauri build`, and automatically attaches the compiled binaries for all OS platforms to the GitHub Release page."
  },
  "execution_phases": {
    "phase_1_cloud_foundation": "Initialize Cloudflare monorepo. Write `wrangler.toml` dynamic D1 bindings. Setup Hono routing and the initial schema migration scripts.",
    "phase_2_crdt_and_sync": "Implement Durable Objects `BotionSyncRoom` with WebSocket Hibernation. Setup Yjs syncing and the D1 periodic state flusher.",
    "phase_3_editor_and_ui": "Install BlockNote, Tailwind, and `next-themes`. Implement the slash commands, callouts, Hugeicons integration, and the minimal borderless layout.",
    "phase_4_databases_and_views": "Build the dynamic property engine and render the Table and Kanban board views connected to the BlockNote state.",
    "phase_5_sidebar_and_linking": "Implement the recursive tree component for the sidebar and the `@` mention page linking system.",
    "phase_6_tauri_and_distribution": "Initialize Tauri v2. Build the Custom Server URL login screen for native apps. Write the GitHub Actions workflow for cross-platform binary releases."
  }
}
