import { useEffect, useMemo } from 'react';
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

export function Editor() {
  const selectedPageId = useUIStore((s) => s.selectedPageId);
  const inlineAIOpen = useUIStore((s) => s.inlineAIOpen);

  const doc = useMemo(() => new Y.Doc(), [selectedPageId]);
  const provider = useMemo(() => {
    if (!selectedPageId) return null;
    return createYjsProvider(selectedPageId, doc, () => {});
  }, [selectedPageId, doc]);

  const editor = useCreateBlockNote({
    schema,
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
          className="prose prose-neutral max-w-none dark:prose-invert"
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
          <SuggestionMenuController
            triggerCharacter="@"
            getItems={async () => []}
            suggestionMenuComponent={({ query, closeMenu }) => (
              <MentionSuggestionMenu
                query={query ?? ''}
                onSelect={(item) => {
                  editor.insertInlineContent([
                    {
                      type: 'mention',
                      props: { pageId: item.id },
                      content: [{ type: 'text', text: item.title, styles: {} }],
                    },
                  ]);
                  closeMenu?.();
                }}
              />
            )}
          />
        </BlockNoteView>

        {inlineAIOpen && (
          <div className="mt-4">
            <InlineAIWidget />
          </div>
        )}

        <BacklinksFooter />
      </div>
    </div>
  );
}
