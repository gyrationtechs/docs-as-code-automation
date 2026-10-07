/** Gate: no filler or half-finished text on added lines. */
import { git } from '../lib/util.mjs';

const PATTERNS = [/\bTODO\b/, /\bTBD\b/, /\bFIXME\b/, /lorem ipsum/i, /\bREPLACE_ME\b/, /\bcoming soon\b/i, /\[IMAGE:?/];

export function run({ files, base }) {
  const findings = [];
  for (const path of files.filter((f) => /\.mdx?$/.test(f))) {
    let diff = '';
    try { diff = git('diff', '-U0', base, '--', path); } catch { continue; }
    for (const line of diff.split('\n')) {
      if (!line.startsWith('+') || line.startsWith('+++')) continue;
      const re = PATTERNS.find((p) => p.test(line));
      if (re) findings.push({ gate: 'placeholder', level: 'blocking', path, message: `placeholder text: ${line.slice(1).trim().slice(0, 80)}` });
    }
  }
  return findings;
}
