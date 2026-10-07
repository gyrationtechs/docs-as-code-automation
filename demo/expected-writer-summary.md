The docs for scheduled send are updated, but the gates still report 2 blocking findings. Both come from the scope gate, and neither is about the content of the three docs pages. All other gates pass.

**Files changed**
- `docs/sdk/messages.mdx`:
  - Added the `scheduledAt` parameter to `send()` and changed its return type to `'queued' | 'scheduled'`.
  - Added a sentence saying the SDK rejects an invalid date or a time outside the 1 minute to 72 hour window before sending.
  - Added a new `cancel` section with its parameter table, return value and the error it throws.
  - Widened the statuses `get()` can return to include `'scheduled'` and `'canceled'`.
- `docs/guides/send-email.mdx`: added two sections, "Schedule an Email" (with a note on the 1 minute to 72 hour window) and "Cancel a Scheduled Email" (with a warning about the `already_sent` error). Each section has its own prerequisites and a code sample that runs on its own.
- `docs/changelog.mdx`: added a v1.3.0 entry dated 2026-10-07 at the top.

**Files left alone**
- `docs/quickstart.mdx`, `docs/introduction.mdx` and `docs/guides/webhooks.mdx` are still accurate. The quickstart's "`status` of `queued`" is still correct for a send without `scheduledAt`. The webhook events in the source don't include scheduled or canceled messages.

**VERIFY flags (2)**
- Both flag the same claim: the API returns HTTP 409 with code `already_sent` when `cancel()` is called after the send time. One is in `sdk/messages.mdx` and one is in `guides/send-email.mdx`. A code comment in the source says this, but the server decides it, so the source can't prove it. The 1 minute to 72 hour window needs no flag because the SDK code enforces it.

**What's in `.pipeline/UNRESOLVED.md`**
- **`README.md` blocks the scope gate.** It's an untracked file that was there before this run, and I didn't touch it. Before this PR, you'll need to commit it separately or remove it.
- **`pipeline/learnings.md` blocks the scope gate.** The prompt asks me to add lessons there, but the work order doesn't list the file, so the two instructions conflict. I kept two dated entries:
  - Vale spell-checks the text inside VERIFY comments, so error codes there need backticks.
  - The scope gate counts untracked files even if the writer never touched them.

  To clear the block, either allow that file in the scope gate or run `git checkout -- pipeline/learnings.md` and commit the entries separately.
- **The `sdk/messages.mdx` description is out of date.** It still says "send() and get()" and doesn't mention `cancel()`. The frontmatter has to stay unchanged, so I suggested new wording for a human to apply.
- **Pre-existing, not fixed:** the webhooks guide has no event for canceled messages. This matches the source, but product may want to confirm that no such event exists.