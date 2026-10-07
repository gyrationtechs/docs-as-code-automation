/**
 * Gate: the agent may only change files on the work order.
 *
 * `Write` cannot be path-restricted at the tool level, so this is the control
 * that actually limits the agent. Files that were already changed when the
 * context was built (the product change itself) are ignored unless the agent
 * modified them afterwards.
 */
import { config, changedFiles, fileHash, git } from '../lib/util.mjs';

// Always writable: the prompt asks the agent to append lessons here.
const ALWAYS_ALLOWED = ['pipeline/learnings.md'];

export function run({ ctx, base }) {
  if (!ctx) return [{ gate: 'scope', level: 'advisory', path: '.', message: 'skipped: no .pipeline/context.json (not an agent run)' }];
  const findings = [];
  const allowed = new Set([...ctx.allowlist, ...ALWAYS_ALLOWED]);
  const untracked = new Set(git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean));
  for (const path of changedFiles(base)) {
    if (ctx.snapshot[path] && ctx.snapshot[path] === fileHash(path)) continue; // pre-existing, untouched
    const denied = config.denied.find((d) => path === d || path.startsWith(d));
    if (denied) { findings.push({ gate: 'scope', level: 'blocking', path, message: `writes to '${denied}' are never permitted` }); continue; }
    if (allowed.has(path)) continue;
    // New files outside the docs (editor or tool caches) are never committed by
    // the pipeline, so they inform rather than block. Edits to tracked files
    // and anything inside the docs folder still block.
    if (untracked.has(path) && !path.startsWith(`${config.docsDir}/`)) {
      findings.push({ gate: 'scope', level: 'advisory', path, message: 'untracked file outside the docs; the pipeline will not commit it' });
      continue;
    }
    findings.push({ gate: 'scope', level: 'blocking', path, message: 'not on the work order (.pipeline/tasks.md); scope is decided by code, not by the model' });
  }
  return findings;
}
