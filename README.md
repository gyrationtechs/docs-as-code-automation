# Docs Automation Starter

A working, minimal version of an AI documentation pipeline: a product code change goes in, and a reviewed docs update comes out as a pull request for a human to approve.

It ships with a fictional SDK (`product/`) and its [Mintlify](https://mintlify.com) docs (`docs/`) so you can run the whole loop in a few minutes, then point it at your own repo.

```
product change ─▶ 1. work order ─▶ 2. writer agent ─▶ 3. gates ─▶ 4. reviewer agent ─▶ docs PR ─▶ human merge
                   (code decides      (edits only the    (code      (fresh context,
                    what's in scope)   allowed files)     checks)    read-only)
```

Built for the workshop **Beyond AI Writing: Building an AI-Powered, Agent-Ready Documentation Pipeline**.

## What's Inside

```
product/src/               The "product": a tiny Node.js SDK. The only source of truth for the API.
docs/                      Mintlify site (docs.json + MDX pages)
docs-pipeline.config.json  Paths, platform and editable surfaces. Start here when adapting.
STYLE.md                   House style, read by both agents
styles/                    The same style rules as Vale checks
pipeline/
  context.mjs              Stage 1: diff the source, find changed symbols and affected pages
  prompts/                 Writer and reviewer prompts
  gates/                   Stage 3: eight checks, cheapest first
  run.mjs                  Runs all four stages locally with the Claude Code CLI
  learnings.md             Notes the writer reads before and appends after each run
  agent-score.mjs          AFDocs agent-readiness scorecard
.claude/
  skills/update-docs/      The same flow, interactive inside Claude Code (/update-docs)
  agents/                  Two read-only reviewer subagents
.github/workflows/
  docs-from-code.yml       CI: product change on main → docs PR
  docs-checks.yml          CI: gates + broken links on every docs PR
  agent-readiness.yml      CI: weekly AFDocs score
demo/scheduled-send.patch  The product change used in the live demo
```

## Prerequisites

| Tool | Needed for | Install |
|---|---|---|
| Node.js 20+ | Everything | [nodejs.org](https://nodejs.org) |
| [Claude Code](https://claude.com/claude-code) | The writer and reviewer agents | `npm install -g @anthropic-ai/claude-code`, then run `claude` once to log in |
| Vale (optional) | The style gate | `brew install vale` |
| Mintlify CLI (optional) | Previewing the docs | Runs through `npx`, no install needed |

## Run the Demo

```bash
git clone <this repo> && cd docs-automation-starter
npm install

# Look at the docs before the change
npm run docs:dev                 # http://localhost:3000

# 1. Make a product change on a branch: adds scheduledAt to messages.send() and a new messages.cancel()
git checkout -b feat/scheduled-send
npm run demo:change

# 2. See what the pipeline thinks it must document (no AI involved yet)
npm run docs:context

# 3. Run the whole pipeline: writer agent → gates → reviewer agent
npm run docs:update

# 4. Inspect the result
git diff -- docs
cat .pipeline/review.md
```

`npm run demo:reset` puts everything back.

### Run It Interactively

Open the repo in Claude Code and type `/update-docs`. You watch the writing happen, the two reviewer subagents run in parallel, and you can step in at any point.

### Try to Break It

The gates exist because agents make specific mistakes. Make them yourself and run `npm run docs:gates`:

- Add `client.messages.reschedule()` to a code sample. The **symbol** gate blocks it because it is not in the source.
- Change a page's `title`. The **frontmatter** gate blocks it.
- Edit `docs/docs.json` or anything in `product/` after building the work order. The **scope** gate blocks it.
- Write `TODO` or link to `/guides/missing`. The **placeholder** and **links** gates block it.

## How It Works

### Code decides scope, the agent decides sentences

| Deterministic code owns | The agent owns |
|---|---|
| Which files may change (`context.mjs`) | Every sentence |
| Which symbols changed | Every line of example code |
| Every gate | Which allowed files actually need edits |
| The final pass/fail | The changelog wording |

The work order is a **permission list, not a checklist**. It over-includes on purpose. The agent leaving a listed page alone because it is still correct is a good outcome.

### The gates

| Gate | Blocks when |
|---|---|
| `scope` | A file outside the work order changed, or a denied path (`product/`, `docs.json`, `.github/`) |
| `frontmatter` | A page lacks `title`/`description`, or an existing page's frontmatter changed |
| `mdx-parse` | A page no longer compiles |
| `symbol` | A new code line uses a method or option that is not in `product/src/` |
| `placeholder` | TODO, TBD, "coming soon" or an image placeholder was added |
| `links` | An internal link points to a page that doesn't exist |
| `verify-flags` | `{/* VERIFY: ... */}` flags remain (advisory for the agent, **blocking** on the PR) |
| `vale` | A Vale rule at error level fails (see `styles/Starter/`) |

The agent runs the gates to check itself, and the pipeline always re-runs them afterwards. An agent's self-report is never the gate result.

### VERIFY flags are the human checkpoint

When the writer states something the source can't prove (a server-side limit, delivery timing), it adds `{/* VERIFY: <claim> */}`. The reviewer agent tries to settle each flag from the source. Anything left blocks the PR in `docs-checks.yml` until a human checks it and deletes the comment.

### Producer and reviewer are separate

The reviewer runs in a fresh context with read-only tools. It never sees the writer's reasoning, so it can't rationalize the writer's choices, and it can't edit what it reviews.

## Set Up CI

1. Push this repo to GitHub.
2. Add the repository secrets:
   - `ANTHROPIC_API_KEY`
   - `DOCS_PR_TOKEN`: a fine-grained PAT for this repo with **Contents: read and write** and **Pull requests: read and write**.
3. Run **Code change → docs PR** from the Actions tab with `dry_run` on. Check the job summary and the `pipeline-output` artifact.
4. Turn `dry_run` off, or push a change under `product/src/` to `main`.

Why a PAT and not `GITHUB_TOKEN`: a pull request opened with `GITHUB_TOKEN` does not trigger other workflows, so `docs-checks.yml` would never run on the bot's PR, and nothing would tell you.

## Adapt It to Your Docs

Everything repo-specific lives in `docs-pipeline.config.json`:

| Key | Meaning |
|---|---|
| `sourceDir`, `sourceExtensions` | Where the product source lives. The symbol gate greps here |
| `docsDir`, `changelog` | Where the docs live |
| `editable` | Pages and folders the agent may ever edit |
| `denied` | Paths the agent may never edit |
| `platform`, `platformNotes` | `mintlify` or `docusaurus`, plus component guidance for the prompt |
| `docsUrl` | The published site, for `npm run agent-score` |

Then:

1. Replace `STYLE.md` and `styles/Starter/` with your style guide.
2. Adjust `apiSymbols()` in `pipeline/lib/util.mjs` if your source isn't JavaScript or TypeScript (for example, match `def name(` for Python).
3. Seed `pipeline/learnings.md` with conventions your team already knows.

**Docusaurus:** set `"platform": "docusaurus"`, point `docsDir` at your `docs/` folder, and replace the `mint broken-links` step in `docs-checks.yml` with `npm run build` (set `onBrokenLinks: 'throw'`).

**Docs in a separate repo:** trigger `docs-from-code.yml` with a `repository_dispatch` from the product repo's release workflow, and check the product out at the release tag into `sourceDir`. If the product repo creates its releases with `GITHUB_TOKEN`, an `on: release` trigger never fires, so send the dispatch from a job inside the release workflow instead.

**A CMS instead of Git (WordPress and similar):** stages 1 to 4 work unchanged on Markdown drafts. Replace the PR step with a script that creates a draft post through your CMS API, and keep publishing as a manual step.

## Check Agent Readiness

```bash
npm run agent-score -- https://your-docs-site.com
```

This runs [AFDocs](https://afdocs.dev), which scores a published site from 0 to 100 against the [Agent-Friendly Documentation Spec](https://agentdocsspec.com/spec/web/). It runs 28 checks across seven categories: discoverability (llms.txt), Markdown availability, page size, content structure, URL stability, observability and authentication. The `agent-readiness.yml` workflow runs it weekly.

The pipeline covers the content side that AFDocs can't see: self-contained sections, runnable samples, real descriptions in frontmatter.

## License

MIT
