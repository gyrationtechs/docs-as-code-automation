// Shared helpers for the docs pipeline. No dependencies beyond Node 20+.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
export const WORK_DIR = join(ROOT, '.pipeline');

export const config = JSON.parse(readFileSync(join(ROOT, 'docs-pipeline.config.json'), 'utf8'));

export const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

export function arg(name, dflt) {
  const i = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return dflt;
  const hit = process.argv[i];
  if (hit.includes('=')) return hit.slice(hit.indexOf('=') + 1);
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

/** Default base: where this branch left main, or the previous commit when on main. */
export function defaultBase() {
  const main = config.mainBranch || 'main';
  try {
    const branch = git('rev-parse', '--abbrev-ref', 'HEAD').trim();
    if (branch !== main) return git('merge-base', main, 'HEAD').trim();
  } catch { /* fall through */ }
  return 'HEAD~1';
}

/** Files that differ from `base`, including uncommitted and untracked changes. */
export function changedFiles(base) {
  const out = new Set();
  for (const l of git('diff', '--name-only', base).split('\n')) if (l.trim()) out.add(l.trim());
  for (const l of git('ls-files', '--others', '--exclude-standard').split('\n')) if (l.trim()) out.add(l.trim());
  return [...out].filter((f) => !f.startsWith('.pipeline/'));
}

export function fileHash(path) {
  const p = join(ROOT, path);
  if (!existsSync(p)) return 'deleted';
  return createHash('sha1').update(readFileSync(p)).digest('hex');
}

export function walk(dir, exts) {
  const out = [];
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const e of readdirSync(abs)) {
    if (['node_modules', '.git', '.pipeline'].includes(e)) continue;
    const p = join(abs, e);
    if (statSync(p).isDirectory()) out.push(...walk(relative(ROOT, p), exts));
    else if (exts.some((x) => e.endsWith(x))) out.push(relative(ROOT, p));
  }
  return out;
}

export function readAt(ref, path) {
  try { return git('show', `${ref}:${path}`); } catch { return null; }
}

/** Split YAML frontmatter from an MDX body. */
export function splitFrontmatter(src) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  if (!m) return { frontmatter: null, body: src, raw: '' };
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { frontmatter: fm, body: src.slice(m[0].length), raw: m[0] };
}

/** Fenced code blocks: [{ lang, label, body, startLine }]. */
export function parseFences(src) {
  const fences = [];
  const lines = src.split('\n');
  let open = null;
  lines.forEach((line, i) => {
    const m = /^\s*(```+|~~~+)\s*([\w+-]*)\s*(.*)$/.exec(line);
    if (!open && m) { open = { tick: m[1], lang: m[2], label: m[3].trim(), body: [], startLine: i + 1 }; return; }
    if (open && line.trim().startsWith(open.tick) && line.trim().replace(/[`~]/g, '') === '') {
      fences.push({ ...open, body: open.body.join('\n') });
      open = null;
      return;
    }
    if (open) open.body.push(line);
  });
  return fences;
}

/**
 * Public API symbols defined in source: class names, method names, the
 * properties a client exposes, and destructured option names in signatures.
 */
export function apiSymbols(srcText) {
  const out = new Set();
  const add = (s) => s && s.length >= 3 && !JS_WORDS.has(s) && out.add(s);
  for (const m of srcText.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) add(m[1]);
  for (const m of srcText.matchAll(/^\s*(?:static\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/gm)) {
    add(m[1]);
    const destructured = /\{([^}]*)\}/.exec(m[2]);
    if (destructured) for (const p of destructured[1].split(',')) add(p.split('=')[0].trim());
  }
  for (const m of srcText.matchAll(/this\.([A-Za-z_$][\w$]*)\s*=\s*new\s+[A-Z]/g)) add(m[1]);
  return out;
}

export function sourceText(ref) {
  const files = walk(config.sourceDir, config.sourceExtensions);
  if (!ref) return files.map((f) => readFileSync(join(ROOT, f), 'utf8')).join('\n');
  const listed = git('ls-tree', '-r', '--name-only', ref, '--', config.sourceDir).split('\n').filter(Boolean);
  return listed.filter((f) => config.sourceExtensions.some((x) => f.endsWith(x))).map((f) => readAt(ref, f) ?? '').join('\n');
}

export const JS_WORDS = new Set(`
  async await break case catch class const constructor continue default delete do else export extends
  false finally for from function if import in instanceof let new null return static super switch this
  throw true try typeof undefined var void while with yield client options object string number boolean
  Promise Array Error returns param
`.split(/\s+/).filter(Boolean));

/** Fill a prompt template in pipeline/prompts/ from the config and the current context. */
export function renderPrompt(file) {
  const ctx = JSON.parse(readFileSync(join(WORK_DIR, 'context.json'), 'utf8'));
  const vars = {
    PRODUCT_NAME: config.productName, PLATFORM: config.platform, DOCS_DIR: config.docsDir,
    SOURCE_DIR: config.sourceDir, CHANGELOG: config.changelog, BASE: ctx.base,
    VERSION: ctx.productVersion ?? 'x.y.z', TODAY: new Date().toISOString().slice(0, 10),
    PLATFORM_NOTES: (config.platformNotes[config.platform] ?? []).map((n) => `- ${n}`).join('\n'),
  };
  let text = readFileSync(join(ROOT, 'pipeline/prompts', file), 'utf8');
  for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{{${k}}}`, String(v));
  return text;
}
