#!/usr/bin/env node
// Print a filled prompt template. Used by CI: node pipeline/render-prompt.mjs update-docs.md
import { renderPrompt } from './lib/util.mjs';
process.stdout.write(renderPrompt(process.argv[2] || 'update-docs.md'));
