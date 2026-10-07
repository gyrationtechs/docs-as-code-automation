# Docs Automation Starter

Workshop repo: a fictional SDK (`product/`) and its Mintlify docs (`docs/`), wired to an AI pipeline that turns a code change into a reviewed docs update.

- Pipeline code: `pipeline/` (context → writer agent → gates → reviewer agent). See README.md.
- To update docs for a change interactively, use the `update-docs` skill.
- Writing rules live in `pipeline/prompts/update-docs.md` and `STYLE.md`. Do not duplicate them elsewhere.
- Never edit `pipeline/gates/`, `.github/` or `styles/` while doing a docs task; the scope gate blocks it.
- `.pipeline/` is scratch output and is gitignored.
