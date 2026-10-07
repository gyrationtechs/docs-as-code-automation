# House Style

Short on purpose. Both the writer agent and the reviewer agent read this file every run, and Vale (`styles/Starter/`) enforces the mechanical parts.

## Voice
- Second person ("you"), present tense, active voice.
- Sentences under 25 words. One idea per sentence.
- No filler: simply, easily, seamless, powerful, robust, leverage. Vale blocks these.

## Structure
- One task per page. Headings name the task in Title Case: "Schedule an Email", not "Overview".
- Open with one sentence that says what the page helps you do.
- Put **Prerequisites:** in the section that needs them.
- Each section must stand alone. No "as mentioned above" or "see below". Agents retrieve sections, not pages.

## Code samples
- Complete and runnable: imports, client setup, the call, and what it returns.
- `YOUR_API_KEY` for secrets, `example.com` for addresses. Never real-looking values.
- Every fence has a language tag and a label: ```` ```js JavaScript ````.
- State the result after the sample ("A successful call returns a `messageId`").

## Reference pages
- A parameter table for every method: Parameter, Type, Required, Description.
- A **Returns:** line with the exact shape from the source.

## Metadata
- Every page: `title`, a `description` of 50 to 160 characters that says what the reader can do, and `keywords`.
