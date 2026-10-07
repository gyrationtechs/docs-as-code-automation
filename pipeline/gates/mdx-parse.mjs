/** Gate: every changed page compiles. One unclosed tag breaks the whole build. */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, splitFrontmatter } from '../lib/util.mjs';

export async function run({ files }) {
  let compile, remarkGfm;
  try {
    ({ compile } = await import('@mdx-js/mdx'));
    remarkGfm = (await import('remark-gfm')).default;
  } catch {
    return [{ gate: 'mdx-parse', level: 'advisory', path: '.', message: 'skipped: run npm install first' }];
  }
  const findings = [];
  for (const path of files.filter((f) => f.endsWith('.mdx'))) {
    if (!existsSync(join(ROOT, path))) continue;
    const { body } = splitFrontmatter(readFileSync(join(ROOT, path), 'utf8'));
    try { await compile(body, { remarkPlugins: [remarkGfm] }); }
    catch (e) { findings.push({ gate: 'mdx-parse', level: 'blocking', path, message: `MDX compile failed${e.line ? ` at body line ${e.line}` : ''}: ${e.reason || e.message}` }); }
  }
  return findings;
}
