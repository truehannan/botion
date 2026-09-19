import { BlockNoteSchema, defaultBlockSpecs, type BlockFromConfig, type PropSchema } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, Zap } from 'lucide-react';

const calloutTypes = {
  info: { icon: Info, label: 'Info', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  warning: { icon: AlertTriangle, label: 'Warning', bg: 'bg-yellow-50 dark:bg-yellow-950/30' },
  danger: { icon: AlertCircle, label: 'Danger', bg: 'bg-red-50 dark:bg-red-950/30' },
  success: { icon: CheckCircle, label: 'Success', bg: 'bg-green-50 dark:bg-green-950/30' },
  tip: { icon: Zap, label: 'Tip', bg: 'bg-purple-50 dark:bg-purple-950/30' },
};

export const calloutPropSchema = {
  type: {
    default: 'info' as keyof typeof calloutTypes,
  },
} satisfies PropSchema;

export const CalloutBlock = createReactBlockSpec(
  {
    type: 'callout',
    propSchema: {
      ...calloutPropSchema,
      textAlignment: { default: 'left' },
      backgroundColor: { default: 'default' },
      textColor: { default: 'default' },
    },
    content: 'inline',
  },
  {
    render: ({ block, contentRef, editor }) => {
      const meta = calloutTypes[block.props.type] ?? calloutTypes.info;
      const Icon = meta.icon;
      return (
        <div
          className={`flex items-start gap-3 rounded-lg px-4 py-3 ${meta.bg}`}
          data-callout-type={block.props.type}
        >
          <div className="mt-0.5 shrink-0 text-neutral-500 dark:text-neutral-400">
            <Icon className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div className="flex-1 text-sm leading-relaxed" ref={contentRef} />
        </div>
      );
    },
  }
);
