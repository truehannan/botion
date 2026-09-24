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
    callout: CalloutBlock,
    code: CodeBlock,
    math: MathBlock,
    toggle: ToggleBlock,
    embed: EmbedBlock,
    multiColumn: MultiColumnBlock,
    column: ColumnBlock,
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    mention: MentionInline,
  },
});

export type BotionBlock = typeof schema.Block;
