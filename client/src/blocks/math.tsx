import { createReactBlockSpec } from '@blocknote/react';
import { useEffect, useRef } from 'react';

export const MathBlock = createReactBlockSpec(
  {
    type: 'math',
    propSchema: { textAlignment: { default: 'center' }, backgroundColor: { default: 'default' }, textColor: { default: 'default' } },
    content: 'inline',
  },
  {
    render: ({ block, editor }) => {
      const ref = useRef<HTMLDivElement>(null);
      useEffect(() => {
        if (!ref.current) return;
        const text = editor.getBlock(block).content?.map((c: any) => (c.type === 'text' ? c.text : '')).join('') ?? '';
        ref.current.innerHTML = text;
      }, [block, editor]);
      return (
        <div data-block-type="math">
          <div ref={editor as any} className="hidden" />
          <div ref={ref} className="py-2 text-sm font-serif text-neutral-800 dark:text-neutral-200" />
        </div>
      );
    },
  }
);
