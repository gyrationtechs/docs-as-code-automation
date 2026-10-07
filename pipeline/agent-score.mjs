#!/usr/bin/env node
// Score the published docs with AFDocs: `npm run agent-score [-- <url>]`.
import { spawnSync } from 'node:child_process';
import { config } from './lib/util.mjs';

const url = process.argv[2] || process.env.DOCS_URL || config.docsUrl;
console.log(`Scoring ${url} against the Agent-Friendly Documentation Spec (afdocs.dev)\n`);
const r = spawnSync('npx', ['-y', 'afdocs@latest', 'check', url, '--format', 'scorecard'], { stdio: 'inherit' });
process.exit(r.status ?? 1);
