import {Fragment} from 'react';

/**
 * Minimal, safe markdown rendering for LLM replies — bullet lists and
 * **bold** only, matching the light markdown the explain/Q&A prompts are
 * instructed to use (lib/explain.ts, lib/qa.ts). Builds React elements
 * directly rather than parsing to HTML, so there's no injection surface —
 * no dangerouslySetInnerHTML, regardless of what the model outputs.
 */

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>;
  });
}

export default function MarkdownText({text}: {text: string}) {
  const lines = text.split('\n');
  const blocks: {type: 'list' | 'text'; lines: string[]}[] = [];

  for (const line of lines) {
    const isBullet = /^[-*]\s+/.test(line.trim());
    const lastBlock = blocks[blocks.length - 1];
    if (isBullet) {
      if (lastBlock?.type === 'list') {
        lastBlock.lines.push(line.trim().replace(/^[-*]\s+/, ''));
      } else {
        blocks.push({
          type: 'list',
          lines: [line.trim().replace(/^[-*]\s+/, '')],
        });
      }
    } else if (line.trim() === '') {
      if (
        lastBlock?.type === 'text' &&
        lastBlock.lines[lastBlock.lines.length - 1] !== ''
      ) {
        lastBlock.lines.push('');
      }
    } else if (lastBlock?.type === 'text') {
      lastBlock.lines.push(line);
    } else {
      blocks.push({type: 'text', lines: [line]});
    }
  }

  return (
    <>
      {blocks.map((block, blockIndex) => {
        if (block.type === 'list') {
          return (
            <ul key={blockIndex} className="my-1 list-disc pl-5">
              {block.lines.map((item, i) => (
                <li key={i}>{renderInline(item, `${blockIndex}-${i}`)}</li>
              ))}
            </ul>
          );
        }
        const paragraphs = block.lines.join('\n').split(/\n{2,}/);
        return (
          <Fragment key={blockIndex}>
            {paragraphs.map((paragraph, i) => (
              <p key={i} className={i > 0 ? 'mt-1' : undefined}>
                {renderInline(paragraph, `${blockIndex}-p${i}`)}
              </p>
            ))}
          </Fragment>
        );
      })}
    </>
  );
}
