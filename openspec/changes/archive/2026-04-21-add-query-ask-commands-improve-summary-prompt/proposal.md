## Why

The bot currently only supports `/summary` for bulk summarization, leaving users with no way to search for specific topics or ask targeted questions about chat history. Adding `/query` and `/ask` closes this gap and makes the bot significantly more useful for active groups.

## What Changes

- New `/query <keyword>` command: server-side keyword search via MTProto, returns formatted message snippets with timestamps and usernames — no AI involved
- New `/ask <question>` command: AI-powered Q&A that fetches recent chat history as context and answers the user's question in-group
- Improved `/summary` system prompt: XML-tag wrapping to prevent prompt injection, clearer Vietnamese instructions, and dynamic detail level based on message count
- Optional summary style selector: brief / detailed / bullet / timeline as a second row on the existing inline keyboard (nice-to-have)

## Capabilities

### New Capabilities

- `keyword-search`: Search chat history by keyword using MTProto server-side search, format and return matching messages with timestamps
- `chat-qa`: AI Q&A over recent chat history — fetch messages via MTProto, send to Anthropic with a structured 3-message prompt, reply in-group

### Modified Capabilities

- `summarization`: Improve system prompt with XML-tag injection defense, clearer output rules, and optional style parameter (brief/detailed/bullet/timeline)

## Impact

- `src/handlers/query.ts` — new file
- `src/handlers/ask.ts` — new file
- `src/services/telegram-client.ts` — add `searchMessages()` method
- `src/services/summarizer.ts` — add `askQuestion()`, improve `buildSystemPrompt()` with XML wrapping and style support
- `src/handlers/summary.ts` — add style row to inline keyboard (optional)
- `src/index.ts` — register two new handlers before `registerChatHandler`
- No new dependencies; reuses existing grammY, GramJS, and Anthropic SDK
