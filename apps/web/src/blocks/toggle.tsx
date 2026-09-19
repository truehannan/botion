import { createReactBlockSpec } from '@blocknote/react';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export const ToggleBlock = createReactBlockSpec(
  {
    type: 'toggle',
    propSchema: {
      open: { default: true },
      textAlignment: { default: 'left' },
      backgroundColor: { default: 'default' },
      textColor: { default: 'default' },
    },
    content: 'inline',
    hasChildren: true,
  },
  {
    render: ({ block, contentRef, editor }) => {
      const [open, setOpen] = useState(block.props.open);

      return (
        <div data-block-type="toggle" className="my-1">
          <button
            onClick={() => {
              setOpen((o) => !o);
              editor.updateBlock(block, { props: { ...block.props, open: !open } });
            }}
            className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left text-sm text-neutral-700 transition hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800/50"
          >
            <ChevronRight
              className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform ${
                open ? 'rotate-90' : ''
              }`}
            />
            <span ref={contentRef} />
          </button>
          {open && block.children.length > 0 && (
            <div className="ml-5 border-l border-neutral-100 pl-3 dark:border-neutral-800">
              {block.children.map((child) => (
                <div key={child.id}>{/* Rendered by BlockNote */}</div>
              ))}
            </div>
          )}
        </div>
      );
    },
  }
);
