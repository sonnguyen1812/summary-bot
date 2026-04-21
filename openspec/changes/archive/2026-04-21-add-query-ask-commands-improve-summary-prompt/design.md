## Context

The bot uses two Telegram connections: grammY (Bot API) for command handling and GramJS (MTProto user client) for reading group message history. The existing `/summary` command already demonstrates the full pattern — MTProto fetch → AI processing → grammY reply. The new commands follow the same pattern with variations.

Current handler registration order in `src/index.ts`:
1. `registerSummaryHandler`
2. `registerClearHandler`
3. `registerChatHandler` (must be last — catches all messages)

Rate limiting is already implemented: 30s per-chat for summary, 10s per-user for chat replies.

## Goals / Non-Goals

**Goals:**
- Add `/query <keyword>` — MTProto server-side search, no AI, fast results
- Add `/ask <question>` — AI Q&A using recent chat history as context
- Harden `/summary` system prompt against prompt injection via XML-tag wrapping
- Keep all changes additive — no breaking changes to existing commands

**Non-Goals:**
- Scheduled/automatic summaries (out of scope)
- Persistent message storage or database
- Private message support (bot is groups-only by design)
- Summary style selector (nice-to-have, deferred)

## Decisions

### D1: /query uses MTProto search API, not in-memory scan

GramJS exposes `client.getMessages(chatId, { search: keyword, limit: N })` which delegates to Telegram's server-side full-text search. This is faster and more accurate than scanning an in-memory buffer, and requires no additional storage.

Alternative considered: scan the last N messages in memory. Rejected — limited recall, no persistence across restarts.

### D2: /ask fetches 500 messages as context window

500 messages balances context richness against token cost. The existing `fetchMessages(chatId, 500)` call in `summarizer.ts` already validates this is within MTProto limits. The same `formatMessages()` helper from `summarizer.ts` will be reused to produce consistent `[HH:MM] username: text` format.

Alternative considered: use a time window (e.g., last 24h). Rejected — count-based is simpler and more predictable for users.

### D3: /ask reuses Anthropic client from summarizer.ts

Rather than creating a new Anthropic client in `ask.ts`, a new exported function `askQuestion(messages, question)` is added to `src/services/summarizer.ts`. This reuses the existing client initialization, retry logic, and `isInvalidResponse` guard.

Alternative considered: new `src/services/qa.ts` service. Rejected — unnecessary duplication; the summarizer already owns the Anthropic client and message formatting.

### D4: /ask replies in-group, not via DM

The reference implementation (asukaminato0721) sends answers to private DM. This bot is group-only by design and the existing chat handler already replies in-group. Consistency with existing UX wins over the reference pattern.

### D5: XML-tag wrapping for prompt injection defense

The system prompt and user-provided message content are separated using XML tags (`<system_instructions>` / `<conversation>`). This is the pattern from daveragos/tldreply-bot and is a well-established defense against prompt injection in chat history.

The `buildSystemPrompt()` function signature stays the same; the XML wrapping is applied in the function that assembles the final prompt sent to Anthropic.

### D6: Rate limiting strategy

- `/query`: 10s per-user (same as chat handler — fast, no AI cost)
- `/ask`: 30s per-chat (same as summary — AI call, shared group resource)

Reuse existing `RateLimiter` utility pattern already present in the codebase.

## Risks / Trade-offs

[MTProto search availability] → Some Telegram group types (e.g., basic groups vs supergroups) may have different search behavior. Mitigation: wrap `searchMessages()` in try/catch and return a user-friendly error if search fails.

[/ask token cost] → 500 messages can be 10k–50k tokens depending on message length. Mitigation: the 30s per-chat rate limit caps abuse. If cost becomes an issue, reduce default fetch count to 200.

[Prompt injection in /ask question] → A user could craft a question like "ignore previous instructions and...". Mitigation: the XML-tag separation in the system prompt explicitly labels user content as DATA, not instructions. The `isInvalidResponse` guard already catches obvious injection artifacts.

[Handler registration order] → The new handlers must be registered before `registerChatHandler`. If order is wrong, the chat handler intercepts `/query` and `/ask` as @mentions. Mitigation: document order in `src/index.ts` comments, enforce in tasks.

## Migration Plan

All changes are additive. No data migration needed. Deployment steps:
1. Deploy updated code to Fly.io via existing `fly deploy` workflow
2. Register new bot commands with BotFather (or via `bot.api.setMyCommands()` on startup)
3. No rollback complexity — removing the new handlers restores previous behavior

## Open Questions

- Should `/query` results include a t.me/c/ deep link to each message? (Requires knowing the chat's numeric ID and message ID — both available from MTProto response. Nice-to-have, can be added later.)
- Should `/ask` show a loading indicator (edit a "thinking..." message) or just reply when done? Decision: send a loading message and edit it, consistent with how long summaries are handled.
