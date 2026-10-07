#!/usr/bin/env node
/**
 * Stage 1: work out what changed in the product and which docs it touches.
 *
 *   node pipeline/context.mjs [--base <git-ref>]
 *
 * Writes .pipeline/context.json (machine-readable) and .pipeline/tasks.md (the
 * agent's work order). Scope is decided HERE, by code, before any model runs.
 * The agent decides which allowed files actually need edits; it never widens
 * the list.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT, WORK_DIR, config, git, arg, defaultBase, changedFiles, fileHash,
  walk, apiSymbols, sourceText,
} from './lib/util.mjs';

const base = arg('base', defaultBase());
mkdirSync(WORK_DIR, { recursive: true });

// 1. The source diff. Uncommitted changes count, so a live demo can edit and run.
const diff = git('diff', '-U0', base, '--', config.sourceDir);
writeFileSync(join(WORK_DIR, 'source.diff'), diff);

const before = apiSymbols(sourceText(base));
const after = apiSymbols(sourceText(null));
const added = [...after].filter((s) => !before.has(s));
const removed = [...before].filter((s) => !after.has(s));

// Symbols that appear on a changed line, plus the client property of any class
// whose file changed (a new method on Messages makes `messages` relevant).
const touched = new Set([...added, ...removed]);
const changedLines = diff.split('\n').filter((l) => /^[+-][^+-]/.test(l)).join('\n');
for (const s of new Set([...before, ...after])) {
  if (new RegExp(`\\b${s}\\b`).test(changedLines)) touched.add(s);
}
const changedSource = diff.split('\n').filter((l) => l.startsWith('+++ b/')).map((l) => l.slice(6));
const clientSrc = sourceText(null);
for (const file of changedSource) {
  let text = '';
  try { text = readFileSync(join(ROOT, file), 'utf8'); } catch { continue; }
  for (const [, cls] of text.matchAll(/\bclass\s+([A-Z][\w$]*)/g)) {
    for (const [, prop] of clientSrc.matchAll(new RegExp(`this\\.([\\w$]+)\\s*=\\s*new\\s+${cls}\\b`, 'g'))) touched.add(prop);
  }
}

// 2. Which pages mention a touched symbol. Fail-safe: over-include, never under.
const pages = {};
for (const page of walk(config.docsDir, ['.mdx', '.md'])) {
  if (page === config.changelog) continue;
  if (!config.editable.some((p) => page === p || page.startsWith(p))) continue;
  const text = readFileSync(join(ROOT, page), 'utf8');
  const hits = [...touched].filter((s) => new RegExp(`\\b${s}\\b`).test(text));
  if (hits.length) pages[page] = hits;
}

const tier = !diff.trim() ? 'none' : touched.size ? 'surface' : 'changelog-only';
const allowlist = tier === 'none' ? [] : [config.changelog, ...Object.keys(pages)];

// 3. Snapshot every file already changed, so the scope gate can tell the
//    product change (pre-existing) apart from what the agent writes.
const snapshot = Object.fromEntries(changedFiles(base).map((f) => [f, fileHash(f)]));

let productVersion = null;
try { productVersion = JSON.parse(readFileSync(join(ROOT, config.productManifest), 'utf8')).version; } catch { /* optional */ }

const context = {
  base, createdAt: new Date().toISOString(), tier, productVersion,
  symbols: { added, removed, touched: [...touched] },
  changedSource, pages, allowlist, snapshot,
};
writeFileSync(join(WORK_DIR, 'context.json'), JSON.stringify(context, null, 2));

const md = [
  '# Docs work order', '',
  `- Base: \`${base}\``,
  `- Product version: \`${productVersion ?? 'unknown'}\``,
  `- Tier: **${tier}**`,
  `- Changed source files: ${changedSource.map((f) => `\`${f}\``).join(', ') || '(none)'}`,
  `- New symbols: ${added.map((s) => `\`${s}\``).join(', ') || '(none)'}`,
  `- Removed symbols: ${removed.map((s) => `\`${s}\``).join(', ') || '(none)'}`,
  '',
  '## Files you may edit', '',
  'This is a permission list, not a checklist. Leaving a file alone because it is still correct is a good outcome.', '',
  `- \`${config.changelog}\`: add one entry for this change at the top.`,
  ...Object.entries(pages).map(([p, hits]) => `- \`${p}\`: mentions ${hits.map((h) => `\`${h}\``).join(', ')}`),
  '',
  '## Not in scope', '',
  'Any other file. If a page is missing from this list, note it in `.pipeline/UNRESOLVED.md` instead of editing it.',
  '',
];
writeFileSync(join(WORK_DIR, 'tasks.md'), md.join('\n'));

console.log(md.join('\n'));
console.log(`context: ${join(WORK_DIR, 'context.json')}`);
