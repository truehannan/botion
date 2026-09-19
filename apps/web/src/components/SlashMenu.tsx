import { getDefaultReactSlashMenuItems } from '@blocknote/react';
import type { BlockNoteEditor } from '@blocknote/core';
import { useUIStore } from '@/stores/uiStore';
import { Sparkles, AlertCircle, Code, Sigma, ChevronDown, Link2, LayoutGrid } from 'lucide-react';

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
  {
    title: 'Callout',
    onItemClick: () => {
      editor.insertBlocks(
        [{ type: 'callout', props: { type: 'info' } }],
        editor.getTextCursorPosition().block
      );
    },
    aliases: ['callout', 'alert', 'note'],
    group: 'Basic',
    icon: <AlertCircle className="h-4 w-4" />,
    subtext: 'A highlighted callout box.',
  },
  {
    title: 'Code Block',
    onItemClick: () => {
      editor.insertBlocks(
        [{ type: 'code', props: { language: 'javascript' } }],
        editor.getTextCursorPosition().block
      );
    },
    aliases: ['code', 'snippet'],
    group: 'Basic',
    icon: <Code className="h-4 w-4" />,
    subtext: 'A code snippet with syntax highlighting.',
  },
  {
    title: 'Math / LaTeX',
    onItemClick: () => {
      editor.insertBlocks(
        [{ type: 'math' }],
        editor.getTextCursorPosition().block
      );
    },
    aliases: ['math', 'latex', 'equation', 'formula'],
    group: 'Basic',
    icon: <Sigma className="h-4 w-4" />,
    subtext: 'A LaTeX math equation.',
  },
  {
    title: 'Toggle',
    onItemClick: () => {
      editor.insertBlocks(
        [{ type: 'toggle', props: { open: true } }],
        editor.getTextCursorPosition().block
      );
    },
    aliases: ['toggle', 'accordion', 'collapse'],
    group: 'Basic',
    icon: <ChevronDown className="h-4 w-4" />,
    subtext: 'A collapsible block with nested children.',
  },
  {
    title: 'Embed',
    onItemClick: () => {
      editor.insertBlocks(
        [{ type: 'embed' }],
        editor.getTextCursorPosition().block
      );
    },
    aliases: ['embed', 'iframe', 'link'],
    group: 'Basic',
    icon: <Link2 className="h-4 w-4" />,
    subtext: 'Embed an external page.',
  },
  {
    title: 'Multi-Column',
    onItemClick: () => {
      editor.insertBlocks(
        [{ type: 'multiColumn', props: { columns: '2' } }],
        editor.getTextCursorPosition().block
      );
    },
    aliases: ['columns', 'split', 'grid'],
    group: 'Basic',
    icon: <LayoutGrid className="h-4 w-4" />,
    subtext: 'A multi-column layout container.',
  },
  ...getDefaultReactSlashMenuItems(editor),
];
