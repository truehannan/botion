import { createReactBlockSpec } from '@blocknote/react';
import { useEffect, useRef } from 'react';

export const MathBlock = createReactBlockSpec(
  {
    type: 'math',
    propSchema: {
      textAlignment: { default: 'center' },
      backgroundColor: { default: 'default' },
      textColor: { default: 'default' },
    },
    content: 'inline',
  },
  {
    render: ({ block, contentRef, editor }) => {
      const ref = useRef<HTMLDivElement>(null);

      useEffect(() => {
        // BlockNote stores inline content; we treat it as LaTeX source
        if (!ref.current) return;
        const text = editor.getBlock(block).content
          ?.map((c) => (c.type === 'text' ? c.text : ''))
          .join('') ?? '';
        ref.current.innerHTML = text; // Would be MathJax/KaTeX in production
      }, [block, editor]);

      return (
        <div data-block-type="math">
          <div ref={contentRef} className="hidden" />
          <div ref={ref} className="py-2 text-sm font-serif text-neutral-800 dark:text-neutral-200" />,
        </div>
      );
    },
  }
);
