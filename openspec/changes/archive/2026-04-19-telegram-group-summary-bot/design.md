## Context

This is a greenfield Telegram bot project. There is no existing codebase to migrate from. The bot will run as a long-polling Node.js process, persist all group messages to a local SQLite database, and serve AI-generated summaries on demand via a slash command. The primary constraints are simplicity of deployment (no server, no webhook, no TLS), cost efficiency (cheapest capable Claude model), and correctness of message capture in group environments.

## Goals / Non-Goals

**Goals:**

- Capture all text and media messages in Telegram groups into a searchable SQLite store
- Provide a `/summary [N]` command that returns an AI-generated, language-aware summary of the last N messages
- Enforce per-chat rate limiting to prevent API cost spikes
- Handle transient API and DB errors gracefully without crashing the bot
- Ship a complete, runnable project with clear environment configuration

**Non-Goals:**

- Webhook-based deployment (long polling only)
- Multi-bot or multi-instance support (single process, single DB file)
- Message editing or deletion tracking
- User-level permissions or admin-only command gating
- Persistent rate limiting across restarts (in-memory only)
- Support for inline commands, callback queries, or non-group chats beyond the private-chat guard
- Data retention policies or message pruning
- Web dashboard or REST API

## Decisions

### D1: grammY over Telegraf

grammY (v1.42+) is the maintained successor in the Node.js Telegram bot ecosystem as of 2026. It ships with native TypeScript types, supports Telegram Bot API 9.6, and has an active release cadence. Telegraf has stagnated. Botgram and node-telegram-bot-api lack TypeScript support quality. grammY is the clear choice.

### D2: better-sqlite3 over lowdb / JSON file / node-sqlite3

better-sqlite3 provides synchronous SQLite access which eliminates async complexity in the message listener hot path. It supports indexed queries needed for efficient `ORDER BY timestamp LIMIT N` lookups and handles growing data without memory pressure. lowdb/JSON would degrade on large message volumes. The async `node-sqlite3` adds unnecessary callback complexity.

### D3: Claude Haiku 4.5 (claude-haiku-4-5-20251001) for summarization

Haiku 4.5 costs $1/MTok input, making it the most affordable Anthropic model capable of coherent multi-turn summarization. A 500-message window at ~50 tokens/message is well within context limits. Quality is sufficient for conversational summarization. Sonnet or Opus would be overkill and 5-20x more expensive.

### D4: Long polling over webhooks

Long polling requires no HTTPS endpoint, no domain, no reverse proxy. It is the correct choice for a locally-run or VPS-deployed bot where simplicity matters. grammY's `bot.start()` handles reconnection automatically.

### D5: In-memory rate limiting (Map)

A `Map<string, number>` keyed by `chat_id` storing the last summary timestamp is sufficient. Rate limit state resets on restart, which is acceptable — the worst case is one extra summary call per restart. Persisting rate limit state to SQLite would add complexity with minimal practical benefit.

### D6: Module structure

```
src/
  config.ts          — env validation, typed config singleton
  bot.ts             — grammY Bot instance + error handler registration
  index.ts           — wires everything together, starts polling, handles shutdown
  handlers/
    message.ts       — on("message") listener, extracts and saves message data
    summary.ts       — /summary command handler, orchestrates fetch + summarize + reply
  services/
    database.ts      — SQLite init, saveMessage, getRecentMessages
    summarizer.ts    — Anthropic client, message formatting, API call with retry
```

Each module has a single responsibility. Handlers depend on services; services do not depend on handlers. `index.ts` is the composition root.

### D7: Media message representation

Media messages are stored with a type descriptor in brackets plus any available caption:
- No caption: `[Photo]`, `[Video]`, `[Sticker]`, etc.
- With caption: `[Photo] caption text`

This preserves signal for the summarizer without storing binary data.

## Risks / Trade-offs

**[Risk] Bot cannot receive messages without correct permissions** → Mitigation: Document in README that privacy mode must be disabled via BotFather OR the bot must be promoted to group admin. This is a Telegram platform constraint, not a code issue.

**[Risk] SQLite file grows unbounded** → Mitigation: Acceptable for V1 scope. Messages are indexed by (chat_id, timestamp) so queries remain fast. Future iteration can add a retention job.

**[Risk] Claude API latency spikes causing slow replies** → Mitigation: The retry logic (1 retry, 2s delay) bounds worst-case wait. grammY's `sendChatAction("typing")` is not implemented in V1 but could be added to improve UX perception.

**[Risk] In-memory rate limit bypassed on restart** → Mitigation: Accepted trade-off per D5. The rate limit is a courtesy throttle, not a security control.

**[Risk] Long polling drops messages during transient network outage** → Mitigation: grammY handles reconnection automatically. Messages sent during downtime are not retroactively fetched (Telegram delivers only from the moment polling resumes).

**[Risk] Large N values (500 messages) produce prompts that approach token limits** → Mitigation: At ~50 tokens/message average, 500 messages ≈ 25k tokens, well within Haiku 4.5's 200k context window. No truncation logic needed for V1.

## Migration Plan

This is a new project with no existing deployment. Steps to run:

1. Clone repo, run `yarn install`
2. Copy `.env.example` to `.env`, fill `BOT_TOKEN` and `ANTHROPIC_API_KEY`
3. Ensure bot privacy mode is disabled in BotFather or bot is admin in the group
4. Run `yarn dev` (tsx watch) for development or `yarn build && yarn start` for production
5. The `data/` directory is created automatically on first run

Rollback: stop the process. No infrastructure to tear down.

## Open Questions

None — all decisions have been made as part of the planning phase.
