import { createReactInlineContentSpec } from '@blocknote/react';
import { useUIStore } from '@/stores/uiStore';

export const MentionInline = createReactInlineContentSpec(
  {
    type: 'mention',
    propSchema: { pageId: { default: '' } },
    content: 'styled',
  },
  {
    render: ({ inlineContent }) => {
      const pages = useUIStore.getState().pages;
      const page = pages.find((p) => p.id === inlineContent.props.pageId);
      return (
        <span onClick={() => { if (page) useUIStore.getState().setSelectedPageId(page.id); }}
          className="inline-flex cursor-pointer items-center gap-1 rounded bg-neutral-100 px-1 text-sm font-medium text-neutral-700 underline decoration-neutral-300 underline-offset-2 dark:bg-neutral-800 dark:text-neutral-300">
          {page?.icon} @{page?.title ?? inlineContent.props.pageId}
        </span>
      );
    },
  }
);
