## Verdict
APPROVE

## Findings
| Severity | File | Finding | Evidence |
|---|---|---|---|
| minor | docs/guides/send-email.mdx (Schedule an Email, Note) | The page says "The SDK throws an error" for a bad `scheduledAt` but doesn't say what kind. It is a plain `Error`, not an `AcmeMailError`. The "Handle Errors" section on the same page tells readers that failures throw `AcmeMailError`, so someone who copies that `instanceof AcmeMailError` check will miss this one. The same applies to the sentence in `sdk/messages.mdx` under `send`. | `messages.js`: `throw new Error('messages.send: scheduledAt is not a valid date')` and `throw new Error('messages.send: scheduledAt must be between 1 minute and 72 hours from now')`. Compare `client.js:43`, where `AcmeMailError` is thrown only when `!res.ok`. |
| minor | docs/guides/send-email.mdx (Cancel a Scheduled Email, example) | The `catch` block only handles `already_sent` and silently drops every other error, such as a 404 for an unknown ID or a network failure. An agent copying this example would hide real failures. Add `else throw error;`. | Example: `if (error instanceof AcmeMailError && error.code === 'already_sent') { ... }` has no else branch. |
| minor | docs/guides/send-email.mdx (intro + frontmatter) | The intro says the call "returns as soon as Acme Mail queues the message", which is no longer true for scheduled sends. The frontmatter `description` and `keywords` don't mention scheduling or canceling, so the new sections are harder to find by search. | `@returns {Promise<{ messageId: string, status: 'queued'\|'scheduled' }>}` |
| minor | docs/sdk/messages.mdx (frontmatter) | `keywords: ["messages", "send", "get", "sdk reference"]` doesn't include `cancel` or `scheduledAt`, so retrieval may miss the new `cancel` section. | New method `async cancel(messageId)` in `messages.js` |

Accuracy: every other claim matches the source:
- **Parameter name and types:** `scheduledAt` accepts a `string` or a `Date` (`@param {string|Date} [options.scheduledAt]`).
- **Limits:** at least 1 minute and at most 72 hours (`MIN_DELAY_MS = 60 * 1000`, `MAX_DELAY_MS = 72 * 60 * 60 * 1000`).
- **Return shapes:** correct for `send`, `cancel` and `get`.
- **Validation timing:** the SDK checks `scheduledAt` before the request goes out (`toScheduleTime` runs before `this.client.request`).
- **`cancel` signature:** `cancel(messageId)` matches the source.

Coverage is complete: the new option, the new method, the new limits, the new statuses on `get`, and a changelog entry are all there. Every new section names its own prerequisites and has a descriptive heading, and none uses an orphan reference like "above".

## VERIFY flags
- **guides/send-email.mdx: "The API returns HTTP 409 with code `already_sent` when `cancel()` is called after the scheduled send time."** CONFIRMED. The source states it in `messages.js`: `@throws {AcmeMailError} 409 with code \`already_sent\` if the send time has passed.` The SDK passes the server's status and code straight through (`client.js:43`: `throw new AcmeMailError(data.message || res.statusText, res.status, data.code)`). The 409 itself comes from the server, so this source is the SDK's stated contract, not proof of what the server does.
- **sdk/messages.mdx: the same claim.** CONFIRMED, with the same evidence and caveat.