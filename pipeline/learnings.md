# Learnings

Durable facts the pipeline has learned. The writer agent reads this at the start of every run and appends new entries at the end. Keep entries verified and dated. Delete any that turn out to be wrong.

## Conventions
- Polyglot examples use `<CodeGroup>` with JavaScript first and cURL last. — seeded

## Gate notes
- The `symbol` gate only checks new lines inside js/ts fences. Response fields that exist only in the API (not the SDK source) belong in prose or a `json` fence. — seeded
- Vale spell-checks text inside `{/* VERIFY: ... */}` comments. Wrap error codes and identifiers in backticks there (for example `` `already_sent` ``) or Vale.Spelling blocks. — 2026-10-07 (added by the writer agent)

## Product facts not visible in the source
<!-- e.g. server-side limits confirmed by the API team, with who confirmed and when -->
