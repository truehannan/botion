import { useEffect, useMemo, useState } from 'react';
import { BlockNoteView, useCreateBlockNote } from '@blocknote/mantine';
import { SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react';
import { useUIStore } from '@/stores/uiStore';
import { createYjsProvider } from '@/lib/yjsProvider';
import * as Y from 'yjs';
import '@blocknote/mantine/style.css';
import { InlineAIWidget } from './InlineAIWidget';
import { getCustomSlashMenuItems } from './SlashMenu';

export function Editor() {
  const selectedPageId = useUIStore((s) => s.selectedPageId);
  const inlineAIOpen = useUIStore((s) => s.inlineAIOpen);

  const doc = useMemo(() => new Y.Doc(), [selectedPageId]);

  // Create Yjs provider synchronously so BlockNote collaboration is ready at mount
  const provider = useMemo(() => {
    if (!selectedPageId) return null;
    return createYjsProvider(selectedPageId, doc, () => {});
  }, [selectedPageId, doc]);

  const editor = useCreateBlockNote({
    collaboration: provider
      ? {
          provider: provider as any,
          fragment: doc.getXmlFragment('document-store'),
          user: { name: 'User', color: '#2563eb' },
        }
      : undefined,
  });

  useEffect(() => {
    return () => {
      provider?.destroy();
    };
  }, [provider]);

  if (!selectedPageId) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-neutral-400">
        Select a page to start editing
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="mx-auto w-full max-w-3xl px-12 py-12">
        <BlockNoteView
          editor={editor}
          className="prose prose-neutral max-w-none"
        >
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) =>
              getCustomSlashMenuItems(editor)
                .filter((item) =>
                  item.title.toLowerCase().includes(query.toLowerCase()) ||
                  item.aliases?.some((a) => a.toLowerCase().includes(query.toLowerCase()))
                )
                .slice(0, 10)
            }
          />
        </BlockNoteView>

        {inlineAIOpen && (
          <div className="mt-4">
            <InlineAIWidget />
          </div>
        )}
      </div>
    </div>
  );
}
