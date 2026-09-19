import { createReactBlockSpec } from '@blocknote/react';
import { useState } from 'react';
import { Link2, ExternalLink } from 'lucide-react';

export const EmbedBlock = createReactBlockSpec(
  {
    type: 'embed',
    propSchema: { url: { default: '' }, caption: { default: '' }, textAlignment: { default: 'left' }, backgroundColor: { default: 'default' }, textColor: { default: 'default' } },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const [url, setUrl] = useState(block.props.url);
      if (!url) {
        return (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/30">
            <Link2 className="h-4 w-4 text-neutral-400" />
            <input type="url" placeholder="Paste embed URL..."
              className="flex-1 bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-400 dark:text-neutral-300"
              onKeyDown={(e) => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value; setUrl(v); editor.updateBlock(block, { props: { ...block.props, url: v } }); } }} />
          </div>
        );
      }
      return (
        <div className="my-2">
          <div className="overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800/30">
            <div className="flex items-center gap-2 px-3 py-2">
              <ExternalLink className="h-3.5 w-3.5 text-neutral-400" />
              <span className="text-xs text-neutral-500 underline">{url}</span>
            </div>
            <iframe src={url} className="h-64 w-full border-0 bg-white dark:bg-neutral-900" sandbox="allow-scripts allow-same-origin" />
          </div>
        </div>
      );
    },
  }
);
