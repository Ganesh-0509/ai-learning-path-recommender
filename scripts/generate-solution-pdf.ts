import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {marked} from 'marked';
import {chromium} from '@playwright/test';

/**
 * Deliverable #3 requires the solution documentation as a PDF/PPT, not
 * markdown — this renders docs/SOLUTION_DOCUMENTATION.md to a styled HTML
 * page and prints it to PDF via Playwright's own bundled Chromium (already a
 * project dependency for the test suite), so no new rendering stack is
 * needed. Source of truth stays the markdown file; rerun this after editing
 * it rather than hand-editing the PDF.
 */

const SOURCE = path.resolve(
  import.meta.dirname,
  '../docs/SOLUTION_DOCUMENTATION.md',
);
const OUTPUT = path.resolve(
  import.meta.dirname,
  '../docs/SOLUTION_DOCUMENTATION.pdf',
);

function wrapHtml(bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Solution Documentation</title>
<style>
  @page { margin: 22mm 20mm; }
  :root {
    --ink: #1c1917;
    --muted: #57534e;
    --accent: #0f766e;
    --rule: #d6d3d1;
    --code-bg: #f5f5f4;
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Georgia', 'Iowan Old Style', 'Palatino Linotype', serif;
    color: var(--ink);
    font-size: 11pt;
    line-height: 1.55;
    max-width: 720px;
    margin: 0 auto;
  }
  h1, h2, h3 {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: var(--ink);
    line-height: 1.25;
    page-break-after: avoid;
  }
  h1 {
    font-size: 22pt;
    margin: 0 0 4pt;
    letter-spacing: -0.01em;
  }
  h1 + h2 {
    font-size: 13pt;
    font-weight: 500;
    color: var(--accent);
    margin: 0 0 18pt;
    border-bottom: 1.5pt solid var(--rule);
    padding-bottom: 12pt;
  }
  h2 {
    font-size: 14.5pt;
    margin: 22pt 0 8pt;
    padding-top: 4pt;
    border-top: 0.75pt solid var(--rule);
  }
  h2:first-of-type { border-top: none; }
  h3 {
    font-size: 12pt;
    margin: 14pt 0 4pt;
  }
  p { margin: 0 0 9pt; }
  ul, ol { margin: 0 0 9pt; padding-left: 20pt; }
  li { margin-bottom: 4pt; }
  li > ul, li > ol { margin-top: 4pt; }
  strong { color: var(--ink); }
  a { color: var(--accent); text-decoration: none; }
  code {
    font-family: 'Consolas', 'SF Mono', Menlo, monospace;
    font-size: 9.5pt;
    background: var(--code-bg);
    padding: 1pt 4pt;
    border-radius: 3pt;
  }
  pre {
    font-family: 'Consolas', 'SF Mono', Menlo, monospace;
    font-size: 8.5pt;
    line-height: 1.4;
    background: var(--code-bg);
    border: 0.75pt solid var(--rule);
    border-radius: 4pt;
    padding: 10pt 12pt;
    overflow-x: auto;
    page-break-inside: avoid;
  }
  pre code { background: none; padding: 0; }
  hr { display: none; }
  .meta {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 9pt;
    color: var(--muted);
    margin: -8pt 0 20pt;
  }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

async function main() {
  const markdown = await readFile(SOURCE, 'utf-8');
  const bodyHtml = await marked.parse(markdown);
  const html = wrapHtml(bodyHtml);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, {waitUntil: 'load'});
    await page.pdf({
      path: OUTPUT,
      format: 'A4',
      printBackground: true,
      margin: {top: '22mm', bottom: '20mm', left: '20mm', right: '20mm'},
    });
  } finally {
    await browser.close();
  }

  console.log(`Wrote ${OUTPUT}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
