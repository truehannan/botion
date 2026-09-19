import { createReactBlockSpec } from '@blocknote/react';

export const ColumnBlock = createReactBlockSpec(
  {
    type: 'column',
    propSchema: {
      textAlignment: { default: 'left' },
      backgroundColor: { default: 'default' },
      textColor: { default: 'default' },
    },
    hasChildren: true,
  },
  {
    render: ({ contentRef }) => {
      return (
        <div data-block-type="column" className="flex-1" ref={contentRef} />
      );
    },
  }
);

export const MultiColumnBlock = createReactBlockSpec(
  {
    type: 'multiColumn',
    propSchema: {
      columns: { default: '2' },
      textAlignment: { default: 'left' },
      backgroundColor: { default: 'default' },
      textColor: { default: 'default' },
    },
    hasChildren: true,
  },
  {
    render: ({ block, editor }) => {
      const count = Math.min(4, Math.max(2, parseInt(block.props.columns ?? '2', 10)));
      return (
        <div data-block-type="multiColumn" className="my-2 flex gap-4">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex-1">
              {block.children[i] ? (
                <div />
              ) : (
                <div className="min-h-[2rem] rounded border border-dashed border-neutral-100 dark:border-neutral-800" />
              )}
            </div>
          ))}
        </div>
      );
    },
  }
);
