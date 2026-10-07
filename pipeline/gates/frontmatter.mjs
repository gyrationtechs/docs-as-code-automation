/**
 * Gate: every page has a title and a useful description, and an existing page's
 * frontmatter comes out byte-identical. Agents love to "improve" metadata;
 * that churns SEO and search snippets without anyone asking for it.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readAt, splitFrontmatter } from '../lib/util.mjs';

export function run({ files, base }) {
  const findings = [];
  for (const path of files.filter((f) => /\.mdx?$/.test(f))) {
    const abs = join(ROOT, path);
    if (!existsSync(abs)) continue;
    const { frontmatter, raw } = splitFrontmatter(readFileSync(abs, 'utf8'));
    if (!frontmatter) { findings.push({ gate: 'frontmatter', level: 'blocking', path, message: 'missing frontmatter' }); continue; }
    if (!frontmatter.title) findings.push({ gate: 'frontmatter', level: 'blocking', path, message: 'missing title' });
    if (!frontmatter.description) findings.push({ gate: 'frontmatter', level: 'blocking', path, message: 'missing description (agents and search use it to pick pages)' });
    else if (frontmatter.description.length < 50) findings.push({ gate: 'frontmatter', level: 'advisory', path, message: `description is ${frontmatter.description.length} chars; aim for 50-160` });
    const old = readAt(base, path);
    if (old !== null && splitFrontmatter(old).raw !== raw) {
      findings.push({ gate: 'frontmatter', level: 'blocking', path, message: 'frontmatter of an existing page changed; restore it exactly' });
    }
  }
  return findings;
}
