import { createReactBlockSpec } from '@blocknote/react';
import { useState } from 'react';

const LANGUAGES = ['javascript', 'typescript', 'python', 'rust', 'go', 'java', 'c', 'cpp', 'csharp', 'ruby', 'php', 'swift', 'kotlin', 'sql', 'html', 'css', 'json', 'yaml', 'markdown', 'bash', 'powershell', 'lua', 'perl', 'r', 'dart'];

export const CodeBlock = createReactBlockSpec(
  {
    type: 'codeBlock',
    propSchema: { language: { default: 'javascript' }, textAlignment: { default: 'left' }, backgroundColor: { default: 'default' }, textColor: { default: 'default' } },
    content: 'inline',
  },
  {
    render: ({ block, contentRef, editor }) => {
      const [lang, setLang] = useState(block.props.language);
      return (
        <div className="group relative rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
          <div className="flex items-center justify-between px-3 py-1.5">
            <select value={lang}
              onChange={(e) => { setLang(e.target.value); editor.updateBlock(block, { props: { language: e.target.value } }); }}
              className="appearance-none bg-transparent text-xs text-neutral-500 outline-none dark:text-neutral-400">
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider">{lang}</span>
          </div>
          <div className="px-3 pb-3">
            <pre data-language={lang} className="!bg-transparent !p-0"><code className={`language-${lang}`} ref={contentRef} /></pre>
          </div>
        </div>
      );
    },
  }
);
