/**
 * Gate: claims the agent could not prove are marked {/* VERIFY: ... *\/}.
 * During an agent run they are advisory (they become the reviewer's checklist).
 * With --strict (the PR check), any remaining flag blocks the merge.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lib/util.mjs';

export function run({ files, strict }) {
  const findings = [];
  for (const path of files.filter((f) => /\.mdx?$/.test(f) && existsSync(join(ROOT, f)))) {
    readFileSync(join(ROOT, path), 'utf8').split('\n').forEach((line, i) => {
      const m = /\{\/\*\s*VERIFY:\s*(.*?)\s*\*\/\}/.exec(line);
      if (m) findings.push({ gate: 'verify-flags', level: strict ? 'blocking' : 'advisory', path, message: `line ${i + 1}: needs a human check: ${m[1]}` });
    });
  }
  return findings;
}
