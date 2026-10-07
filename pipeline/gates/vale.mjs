/** Gate: the style guide as code. Vale errors block; warnings and suggestions inform. */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lib/util.mjs';

export function run({ files }) {
  const targets = files.filter((f) => /\.mdx?$/.test(f) && existsSync(join(ROOT, f)));
  if (!targets.length) return [];
  let out;
  try {
    out = execFileSync('vale', ['--output=JSON', '--no-exit', ...targets], { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    if (e.code === 'ENOENT') return [{ gate: 'vale', level: 'advisory', path: '.', message: 'skipped: vale is not installed (brew install vale)' }];
    out = e.stdout || '{}';
  }
  const findings = [];
  for (const [path, alerts] of Object.entries(JSON.parse(out || '{}'))) {
    for (const a of alerts) {
      findings.push({ gate: 'vale', level: a.Severity === 'error' ? 'blocking' : 'advisory', path, message: `line ${a.Line}: ${a.Check}: ${a.Message}` });
    }
  }
  return findings;
}
