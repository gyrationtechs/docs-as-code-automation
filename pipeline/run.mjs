#!/usr/bin/env node
/**
 * Run the whole pipeline locally: context → writer agent → gates → reviewer agent.
 *
 *   node pipeline/run.mjs [--base <ref>] [--model <id>] [--skip-review] [--pr]
 *
 * Requires the Claude Code CLI (`claude`) to be installed and logged in.
 * In CI the same steps run in .github/workflows/docs-from-code.yml.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, WORK_DIR, config, arg, git, renderPrompt as render } from './lib/util.mjs';

const C = { dim: '\x1b[2m', b: '\x1b[1m', blue: '\x1b[34m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', off: '\x1b[0m' };
const step = (n, title) => console.log(`\n${C.b}${C.blue}[${n}] ${title}${C.off}`);

const WRITER_TOOLS = [
  'Read', 'Glob', 'Grep', 'Edit', 'Write', 'TodoWrite',
  'Bash(node pipeline/gates/run-all.mjs)', 'Bash(node pipeline/gates/run-all.mjs:*)',
  'Bash(git diff:*)', 'Bash(git status:*)', 'Bash(git checkout -- :*)',
];
const REVIEWER_TOOLS = ['Read', 'Glob', 'Grep', 'Bash(git diff:*)', 'Bash(git status:*)'];
const DENIED = ['WebFetch', 'WebSearch', 'Bash(git push:*)', 'Bash(git commit:*)', 'Bash(git reset:*)', 'Bash(gh:*)', 'Bash(curl:*)', 'Bash(rm:*)'];

/** Run `claude -p` headless, streaming a one-line trace of each tool call. */
function claude(prompt, { allowed, disallowed = [], maxTurns = 40 }) {
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--max-turns', String(maxTurns),
    '--allowedTools', allowed.join(','), '--disallowedTools', [...DENIED, ...disallowed].join(',')];
  if (arg('model')) args.push('--model', arg('model'));
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { cwd: ROOT, stdio: ['pipe', 'pipe', 'inherit'] });
    child.on('error', (e) => reject(new Error(`could not start claude: ${e.message}. Install Claude Code and run \`claude\` once to log in.`)));
    child.stdin.end(prompt);
    let buf = '', result = null;
    child.stdout.on('data', (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === 'assistant') {
          for (const c of ev.message?.content ?? []) {
            if (c.type !== 'tool_use') continue;
            const t = c.input?.file_path?.replace(ROOT + '/', '') ?? c.input?.command ?? c.input?.pattern ?? '';
            console.log(`  ${C.dim}→ ${c.name}${C.off} ${t}`.slice(0, 160));
          }
        }
        if (ev.type === 'result') result = ev;
      }
    });
    child.on('close', (code) => (result ? resolve(result) : reject(new Error(`claude exited ${code} with no result`))));
  });
}

// 1. Context ---------------------------------------------------------------
step(1, 'Detect the product change and build the work order');
const ctxArgs = ['pipeline/context.mjs', ...(arg('base') ? ['--base', arg('base')] : [])];
if (spawnSync('node', ctxArgs, { cwd: ROOT, stdio: 'inherit' }).status !== 0) process.exit(1);
const ctx = JSON.parse(readFileSync(join(WORK_DIR, 'context.json'), 'utf8'));
if (ctx.tier === 'none') { console.log(`\n${C.yellow}No source changes since ${ctx.base}. Nothing to document.${C.off}`); process.exit(0); }

// 2. Writer ----------------------------------------------------------------
step(2, 'Writer agent updates the docs (can edit only the work order)');
const writer = await claude(render('update-docs.md'), { allowed: WRITER_TOOLS, maxTurns: 50 });
writeFileSync(join(WORK_DIR, 'writer-summary.md'), writer.result ?? '');
console.log(`\n${writer.result ?? ''}\n${C.dim}turns: ${writer.num_turns} · cost: $${(writer.total_cost_usd ?? 0).toFixed(2)}${C.off}`);

// 3. Gates -----------------------------------------------------------------
step(3, 'Gates re-run independently (the agent\'s self-check is not trusted)');
const gates = spawnSync('node', ['pipeline/gates/run-all.mjs'], { cwd: ROOT, stdio: 'inherit' });

// 4. Reviewer --------------------------------------------------------------
let review = null;
if (!arg('skip-review')) {
  step(4, 'Reviewer agent checks accuracy in a fresh context (read-only)');
  review = await claude(render('review-docs.md'), { allowed: REVIEWER_TOOLS, disallowed: ['Edit', 'Write'], maxTurns: 25 });
  writeFileSync(join(WORK_DIR, 'review.md'), review.result ?? '');
  console.log(`\n${review.result ?? ''}`);
}

// 5. Summary / PR ----------------------------------------------------------
const unresolved = existsSync(join(WORK_DIR, 'UNRESOLVED.md')) ? readFileSync(join(WORK_DIR, 'UNRESOLVED.md'), 'utf8') : '';
const verdict = /CHANGES REQUESTED/.test(review?.result ?? '') ? `${C.yellow}changes requested${C.off}` : review ? `${C.green}approve${C.off}` : 'skipped';
step(5, 'Summary');
console.log(`  gates:    ${gates.status === 0 ? `${C.green}pass${C.off}` : `${C.red}blocking findings${C.off}`}`);
console.log(`  review:   ${verdict}`);
console.log(`  open questions: ${unresolved ? '.pipeline/UNRESOLVED.md' : 'none'}`);
console.log(`  diff:     git diff ${ctx.base} -- ${config.docsDir}`);

if (arg('pr')) {
  const docsFiles = ctx.allowlist.filter((f) => git('status', '--porcelain', '--', f).trim());
  if (!docsFiles.length) { console.log('No docs files changed; no PR.'); process.exit(0); }
  const body = [
    `Automated docs update for the change since \`${ctx.base.slice(0, 7)}\`.`, '',
    readFileSync(join(WORK_DIR, 'gate-report.md'), 'utf8'), '',
    '### Reviewer agent', '', review?.result ?? '_skipped_', '',
    unresolved ? `### Needs a human decision\n\n${unresolved}` : '',
    '', '#### Reviewer checklist', '- [ ] Every code sample matches the source', '- [ ] Every VERIFY flag is resolved and removed', '- [ ] The changelog entry is accurate',
  ].join('\n');
  writeFileSync(join(WORK_DIR, 'pr-body.md'), body);
  spawnSync('git', ['add', ...docsFiles], { cwd: ROOT, stdio: 'inherit' });
  spawnSync('git', ['commit', '-m', `docs: update for ${ctx.symbols.added.concat(ctx.symbols.removed).join(', ') || 'product change'}`], { cwd: ROOT, stdio: 'inherit' });
  spawnSync('git', ['push', '-u', 'origin', 'HEAD'], { cwd: ROOT, stdio: 'inherit' });
  spawnSync('gh', ['pr', 'create', '--title', 'Docs: update for the latest product change', '--body-file', join(WORK_DIR, 'pr-body.md'), '--label', 'ai-draft'], { cwd: ROOT, stdio: 'inherit' });
}
process.exit(gates.status === 0 ? 0 : 1);
