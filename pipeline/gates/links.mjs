/** Gate: internal links on changed pages resolve to a real page. */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, config } from '../lib/util.mjs';

const exists = (p) => ['.mdx', '.md', '/index.mdx', '/index.md'].some((x) => existsSync(join(ROOT, config.docsDir, p + x)));

export function run({ files }) {
  const findings = [];
  for (const path of files.filter((f) => /\.mdx?$/.test(f) && existsSync(join(ROOT, f)))) {
    const text = readFileSync(join(ROOT, path), 'utf8');
    for (const m of text.matchAll(/\]\((\/[^)#\s]*)(?:#[^)]*)?\)|href="(\/[^"#]*)/g)) {
      const target = (m[1] || m[2]).replace(/\/$/, '') || '/index';
      if (!exists(target)) findings.push({ gate: 'links', level: 'blocking', path, message: `broken internal link ${target}` });
    }
  }
  return findings;
}
