import { getDefaultReactSlashMenuItems } from '@blocknote/react';
import type { BlockNoteEditor } from '@blocknote/core';
import { useUIStore } from '@/stores/uiStore';
import { Sparkles } from 'lucide-react';

export const getCustomSlashMenuItems = (editor: BlockNoteEditor) => [
  {
    title: 'Ask Botion Agent',
    onItemClick: () => {
      useUIStore.getState().setInlineAIOpen(true);
    },
    aliases: ['ai', 'agent', 'generate'],
    group: 'AI Tools',
    icon: <Sparkles className="h-4 w-4" />,
    subtext: 'Ask the workspace agent a question or generate text.',
  },
  ...getDefaultReactSlashMenuItems(editor),
];
