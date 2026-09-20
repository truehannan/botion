import { useEffect, useMemo, useCallback } from 'react';
import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote, SuggestionMenuController } from '@blocknote/react';
import { useUIStore } from '@/stores/uiStore';
import { createYjsProvider } from '@/lib/yjsProvider';
import * as Y from 'yjs';
import '@blocknote/mantine/style.css';
import { InlineAIWidget } from './InlineAIWidget';
import { BacklinksFooter } from './BacklinksFooter';
import { getCustomSlashMenuItems } from './SlashMenu';
import { MentionSuggestionMenu } from './MentionSuggestionMenu';
import { schema } from '@/blocks/schema';
import { api } from '@/lib/api';
import { saveSnapshot, loadSnapshot, queueSync, drainSyncQueue, debounce, prefersLocalSync } from '@/lib/persistence';

export function Editor() {
  const selectedPageId = useUIStore((s) => s.selectedPageId);
  const inlineAIOpen = useUIStore((s) => s.inlineAIOpen);
  const activeWorkspaceId = useUIStore((s) => s.activeWorkspaceId);

  const doc = useMemo(() => new Y.Doc(), [selectedPageId]);
  const shouldUseLocalSync = prefersLocalSync();

  // Only create WebSocket provider in non-local mode
  const provider = useMemo(() => {
    if (!selectedPageId || shouldUseLocalSync) return null;
    return createYjsProvider(selectedPageId, doc, () => {});
  }, [selectedPageId, doc, shouldUseLocalSync]);

  const editor = useCreateBlockNote({
    schema,
    collaboration: provider
      ? { provider: provider as any, fragment: doc.getXmlFragment('document-store'), user: { name: 'User', color: '#2563eb' } }
      : undefined,
  });

  // ── Client-side auto-save (debounced) ────────────────────────────
  const autoSave = useCallback(
    debounce(async (pageId: string, editorInstance: any) => {
      const blocks = editorInstance.document;
      const titleBlock = blocks.find((b: any) => b.type === 'heading')?.content?.map((c: any) => c.text).join('') ?? 'Untitled';

      // Save to IndexedDB immediately (offline resilience)
      await saveSnapshot(pageId, titleBlock, blocks);

      // Sync to server via REST
      try {
        await api.sync.post(pageId, {
          blocks,
          title: titleBlock,
          workspaceId: activeWorkspaceId ?? undefined,
        });
        // Drain any pending sync queue
        await drainSyncQueue((pid, b) => api.sync.post(pid, { blocks: b, workspaceId: activeWorkspaceId ?? undefined }));
      } catch {
        // Queue for retry when network returns
        await queueSync(pageId, blocks);
      }
    }, 2500),
    [activeWorkspaceId]
  );

  useEffect(() => {
    if (!selectedPageId || !editor) return;

    // Load previous snapshot on mount
    loadSnapshot(selectedPageId).then((snap) => {
      if (snap?.content && Array.isArray(snap.content)) {
        try {
          editor.replaceBlocks(editor.document, snap.content);
        } catch { /* ignore */ }
      }
    });

    // Set up auto-save listener
    const unsub = editor.onChange(() => {
      autoSave(selectedPageId, editor);
    });

    // Save on visibility change
    const handleVis = () => {
      if (document.visibilityState === 'hidden') {
        autoSave(selectedPageId, editor);
      }
    };
    document.addEventListener('visibilitychange', handleVis);

    // Save before unload
    const handleUnload = () => {
      autoSave(selectedPageId, editor);
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      unsub();
      document.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('beforeunload', handleUnload);
      provider?.destroy();
    };
  }, [selectedPageId, editor, autoSave, provider]);

  if (!selectedPageId) {
    return <div className="flex flex-1 items-center justify-center text-sm text-neutral-400">Select a page to start editing</div>;
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="mx-auto w-full max-w-3xl px-12 py-12">
        <BlockNoteView editor={editor} className="prose prose-neutral max-w-none dark:prose-invert">
          <SuggestionMenuController triggerCharacter="/"
            getItems={async (query) => getCustomSlashMenuItems(editor).filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase()) ||
              item.aliases?.some((a) => a.toLowerCase().includes(query.toLowerCase()))
            ).slice(0, 10)} />
          <SuggestionMenuController triggerCharacter="@" getItems={async () => []}
            suggestionMenuComponent={({ query, closeMenu }) => (
              <MentionSuggestionMenu query={query ?? ''} onSelect={(item) => {
                editor.insertInlineContent([{ type: 'mention', props: { pageId: item.id }, content: [{ type: 'text', text: item.title, styles: {} }] }]);
                closeMenu?.();
              }} />
            )} />
        </BlockNoteView>
        {inlineAIOpen && <div className="mt-4"><InlineAIWidget /></div>}
        <BacklinksFooter />
      </div>
    </div>
  );
}
