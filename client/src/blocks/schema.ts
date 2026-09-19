import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from '@blocknote/core';
import { CalloutBlock } from './callout';
import { CodeBlock } from './code';
import { MathBlock } from './math';
import { ToggleBlock } from './toggle';
import { EmbedBlock } from './embed';
import { MultiColumnBlock, ColumnBlock } from './multiColumn';
import { MentionInline } from './mention';

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    callout: CalloutBlock.config,
    code: CodeBlock.config,
    math: MathBlock.config,
    toggle: ToggleBlock.config,
    embed: EmbedBlock.config,
    multiColumn: MultiColumnBlock.config,
    column: ColumnBlock.config,
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    mention: MentionInline.config,
  },
});

export type BotionBlock = typeof schema.Block;
