## Why

Group chats on Telegram accumulate large volumes of messages quickly, making it difficult for members who were offline to catch up. A bot that can on-demand summarize recent group conversation using AI removes the need to scroll through long history and provides immediate context.

## What Changes

- Introduce a new standalone Telegram bot application (TypeScript/Node.js) at the project root
- Bot collects and persists every group message to a local SQLite database
- Adds a `/summary [N]` command that fetches recent messages and returns an AI-generated summary via Claude Haiku 4.5
- Adds per-chat rate limiting (1 request per 30 seconds) to avoid API abuse
- New runtime dependencies: grammY, better-sqlite3, @anthropic-ai/sdk, dotenv
- Configuration is fully environment-variable-driven with validation at startup

## Capabilities

### New Capabilities

- `message-collection`: Listens to all group messages (text and media) and stores them in SQLite with metadata (chat_id, user info, timestamp, message type)
- `summary-command`: Handles the `/summary [N]` slash command — validates input, enforces group-only restriction, applies per-chat rate limiting, fetches stored messages, calls Claude Haiku for summarization, and replies in the group
- `ai-summarization`: Formats stored messages into a structured prompt and calls the Claude Haiku 4.5 API to produce a concise, language-aware bullet-point summary with one retry on failure
- `bot-infrastructure`: Project scaffold — grammY bot setup, entry point with graceful shutdown, SQLite initialization, and environment-based configuration loading

### Modified Capabilities

<!-- No existing capabilities are being modified. This is a greenfield project. -->

## Impact

- **New project**: All files are new; no existing code is modified
- **External dependencies**: Telegram Bot API (long polling, no webhook/HTTPS required), Anthropic Claude API (Haiku 4.5 model, paid per token)
- **Infrastructure**: Requires a running Node.js process; SQLite file stored at `./data/messages.db` (excluded from git)
- **Secrets required**: `BOT_TOKEN` (BotFather) and `ANTHROPIC_API_KEY` must be present in environment before startup
- **Privacy**: Bot must have privacy mode disabled in BotFather **or** be promoted to group admin to receive all messages
