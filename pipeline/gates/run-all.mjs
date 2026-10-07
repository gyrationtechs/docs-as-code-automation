#!/usr/bin/env node
/**
 * Run every gate, cheapest first, and write .pipeline/gate-report.{json,md}.
 *
 *   node pipeline/gates/run-all.mjs [--base <ref>] [--strict]
 *
 * Exit 1 on any blocking finding. The agent runs this to check its own work,
 * but the pipeline always re-runs it afterwards: an agent's self-report is
 * never the gate result.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { WORK_DIR, config, arg, defaultBase, changedFiles, fileHash } from '../lib/util.mjs';

const ctxPath = join(WORK_DIR, 'context.json');
const ctx = existsSync(ctxPath) && !arg('no-context') ? JSON.parse(readFileSync(ctxPath, 'utf8')) : null;
const base = arg('base', ctx?.base ?? defaultBase());
const strict = Boolean(arg('strict', false));

// Gate the files this run changed, not the product change that triggered it.
// Content gates look at docs pages only; the scope gate checks every path itself.
const files = changedFiles(base)
  .filter((f) => f.startsWith(`${config.docsDir}/`))
  .filter((f) => !(ctx?.snapshot[f] && ctx.snapshot[f] === fileHash(f)));

const GATES = ['scope', 'frontmatter', 'mdx-parse', 'symbol', 'placeholder', 'links', 'verify-flags', 'vale'];
const findings = [];
for (const name of GATES) {
  try {
    const { run } = await import(`./${name}.mjs`);
    findings.push(...(await run({ ctx, base, files, strict })));
  } catch (e) {
    findings.push({ gate: name, level: 'blocking', path: '.', message: `gate crashed: ${e.message}` });
  }
}

const blocking = findings.filter((f) => f.level === 'blocking');
const advisory = findings.filter((f) => f.level !== 'blocking');
mkdirSync(WORK_DIR, { recursive: true });
writeFileSync(join(WORK_DIR, 'gate-report.json'), JSON.stringify({ base, files, ok: !blocking.length, blocking, advisory }, null, 2));

const md = [`### Gate report`, '', `- files checked: ${files.length}`, `- blocking: **${blocking.length}**`, `- advisory: ${advisory.length}`, ''];
if (blocking.length) md.push('#### Blocking', '', ...blocking.map((f) => `- \`${f.path}\` **[${f.gate}]** ${f.message}`), '');
if (advisory.length) md.push('<details><summary>Advisory</summary>', '', ...advisory.map((f) => `- \`${f.path}\` [${f.gate}] ${f.message}`), '', '</details>');
writeFileSync(join(WORK_DIR, 'gate-report.md'), md.join('\n'));
console.log(md.join('\n'));
process.exit(blocking.length ? 1 : 0);
