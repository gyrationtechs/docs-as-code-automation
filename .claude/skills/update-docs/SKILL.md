---
name: update-docs
description: Update the docs for a product code change, then review the result with fresh-context subagents and run the gates. Use when someone says "update the docs for this change", "document this branch", "what docs does this PR affect", or runs /update-docs. Optional argument base=<git-ref> (defaults to where this branch left main).
---

# Update Docs From a Code Change

The interactive version of `pipeline/run.mjs`. Same work order, same gates, but you do the writing in this session and hand the review to subagents, so the person can watch and step in.

## 1. Build the work order

```bash
node pipeline/context.mjs            # or: node pipeline/context.mjs --base <ref>
```

Read `.pipeline/tasks.md` and `.pipeline/source.diff`. If the tier is `none`, say there is nothing to document and stop.

Show the person the work order in two or three lines (changed symbols, files in scope) before you edit anything.

## 2. Write

Follow `pipeline/prompts/update-docs.md` exactly. It is the single source of truth for the writing rules; do not restate or loosen them here. Fill its placeholders from `docs-pipeline.config.json` and `.pipeline/context.json`.

Run `node pipeline/gates/run-all.mjs` after each editing pass. Up to three passes.

## 3. Review in fresh context

Dispatch both subagents **in parallel**, each with only the base ref and the list of changed docs files. Do not pass them your reasoning or the writing conversation; the point is that they judge the artifact, not your intent.

- `docs-accuracy-reviewer`: every API claim against `product/src/`
- `docs-agent-readiness-reviewer`: whether each changed section stands alone for an agent

Apply findings rated `blocker` or `major`. List `minor` ones for the person to decide.

## 4. Gate and report

Run `node pipeline/gates/run-all.mjs` one last time. Report:

- files changed and files left alone (with why)
- gate result (blocking count)
- reviewer verdicts
- remaining `VERIFY` flags: these are the human's checklist
- anything in `.pipeline/UNRESOLVED.md`

Do not commit or open a PR unless the person asks.
