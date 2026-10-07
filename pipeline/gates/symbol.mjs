/**
 * Gate: never invent an API. Every member name or option key on a NEW line of a
 * code sample must exist somewhere in the product source. A hallucinated method
 * (or one an injected instruction asked for) cannot pass, because it would have
 * to already exist in shipped code.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, config, git, parseFences, sourceText, JS_WORDS } from '../lib/util.mjs';

const STOP = new Set(`
  log error warn info env then json stringify parse toISOString now length map forEach push filter
  includes slice split join keys values entries status code message name catch finally exit argv
  setTime getTime Date Math floor round random headers body method default
`.split(/\s+/).filter(Boolean));

function addedLines(path, base) {
  const out = new Set();
  let diff = '';
  try { diff = git('diff', '-U0', base, '--', path); } catch { return out; }
  if (!diff) {                                        // untracked: every line is new
    try { readFileSync(join(ROOT, path), 'utf8').split('\n').forEach((l) => out.add(l)); } catch { /* */ }
    return out;
  }
  for (const l of diff.split('\n')) if (l.startsWith('+') && !l.startsWith('+++')) out.add(l.slice(1));
  return out;
}

export function run({ files, base }) {
  const hay = sourceText(null);
  if (!hay.trim()) return [{ gate: 'symbol', level: 'blocking', path: config.sourceDir, message: 'source is empty; refusing to run against an empty haystack' }];
  const findings = [];
  for (const path of files.filter((f) => /\.mdx?$/.test(f) && existsSync(join(ROOT, f)))) {
    const fresh = addedLines(path, base);
    if (!fresh.size) continue;
    for (const fence of parseFences(readFileSync(join(ROOT, path), 'utf8'))) {
      if (!config.fenceLanguages.includes(fence.lang)) continue;
      for (const line of fence.body.split('\n')) {
        if (!fresh.has(line)) continue;
        const code = line.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""').replace(/\/\/.*$/, '');
        const idents = new Set();
        for (const m of code.matchAll(/\.([A-Za-z_$][\w$]*)/g)) idents.add(m[1]);
        for (const m of code.matchAll(/([A-Za-z_$][\w$]*)\s*:(?!:)/g)) idents.add(m[1]);
        for (const id of idents) {
          if (id.length < 3 || STOP.has(id) || JS_WORDS.has(id) || /^[A-Z0-9_]+$/.test(id)) continue; // env vars
          if (new RegExp(`\\b${id}\\b`).test(hay)) continue;
          findings.push({ gate: 'symbol', level: 'blocking', path, message: `'${id}' is not in ${config.sourceDir}; if you cannot grep it in the source, it does not exist` });
        }
      }
    }
  }
  return findings;
}
