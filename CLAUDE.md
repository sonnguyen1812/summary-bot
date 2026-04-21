# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Telegram group chat summary bot. Users send `/summary` in a group to get an AI-generated summary of recent messages. The bot also responds conversationally when mentioned or replied to.

**Stack:** TypeScript (ESM), grammY (Bot API), telegram (MTProto/GramJS), Anthropic SDK, deployed on Fly.io via Docker.

## Commands

```bash
yarn dev          # Dev with hot-reload (tsx watch)
yarn build        # TypeScript compile to dist/
yarn start        # Run compiled bot (node dist/index.js)
```

First-time MTProto login (saves session to `data/session.txt`):
```bash
npx tsx src/login.ts
```

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | yes | Telegram Bot API token |
| `AI_API_KEY` | yes | Anthropic API key |
| `TG_API_ID` | yes | Telegram API ID (integer) |
| `TG_API_HASH` | yes | Telegram API hash |
| `AI_BASE_URL` | no | Override Anthropic base URL |
| `AI_MODEL` | no | AI model (default: `claude-haiku-4-5`) |
| `TG_PHONE` | no | Phone number for MTProto auth |

## Architecture

The bot uses **two Telegram connections** simultaneously:

1. **grammY (Bot API)** — handles commands, sends replies, manages inline keyboards. Entry point: `src/bot.ts` creates the `Bot` instance, `src/index.ts` wires handlers and starts long polling.

2. **GramJS (MTProto user client)** — fetches message history from groups (Bot API can't read group history without being an admin). Managed by `src/services/telegram-client.ts`. Requires a one-time interactive login via `src/login.ts` and persists the session to `data/session.txt`.

### Handler Registration Order

Handlers are registered in `src/index.ts` in this order — **command handlers first, then message handlers**:
1. `registerSummaryHandler` — `/summary` command + inline keyboard callbacks
2. `registerClearHandler` — `/clear` command
3. `registerChatHandler` — `on("message")` handler for @mention/reply conversations

This order matters because grammY matches sequentially; the chat handler must come last to avoid intercepting commands.

### Key Flows

**Summary flow** (`handlers/summary.ts` → `services/telegram-client.ts` → `services/summarizer.ts`):
- `/summary` without args shows an inline keyboard with preset options (50/100/200/500 messages, 6h/12h/1d/3d)
- `/summary 100` or `/summary 12h` directly executes
- Messages fetched via MTProto, then sent to Anthropic for summarization
- Per-chat rate limiting (default 30s between summaries)
- Long summaries are split at newline boundaries (4096 char Telegram limit)

**Chat flow** (`handlers/chat.ts` → `services/chat.ts`):
- Triggers on @mention or reply-to-bot in groups only
- In-memory conversation context per chat (8 messages, 1h TTL)
- Post-processing replaces formal Vietnamese with casual slang and randomly adds emoticons/fillers
- Separate per-user rate limit (10s)

**Clear flow** (`handlers/clear.ts` → `services/telegram-client.ts`):
- `/clear` finds bot messages and `/summary`/`/clear` commands via MTProto, deletes them via Bot API
- Auto-deletes its own confirmation after 5s

### Services

- `services/summarizer.ts` — Anthropic API client for summarization. Dynamically adjusts detail level based on message count. Has prompt injection guard (`isInvalidResponse`) and retry logic.
- `services/chat.ts` — Anthropic API client for conversational replies. Uses a persona system prompt ("Minh", casual Vietnamese). Includes `postProcessResponse` that rewrites formal phrases to slang.
- `services/message-tracker.ts` — In-memory tracking of bot message IDs per chat (used by `/clear`). Caps at 200 per chat.
- `services/telegram-client.ts` — MTProto client lifecycle + message fetching. `fetchMessages` (by count), `fetchMessagesSince` (by timestamp), `fetchBotRelatedMessageIds` (for cleanup).

## Deployment

Deployed on Fly.io (app: `summary-bot-avada`, region: `sin`). Uses a persistent volume mounted at `/app/data` for the MTProto session file. The health check HTTP server on port 8080 keeps the machine alive (`auto_stop_machines = 'off'`).

## Conventions

- Always use `yarn`, not `npm`
- All imports use `.js` extension (ESM with NodeNext module resolution)
- Vietnamese UI strings throughout (user-facing messages, command descriptions)
- Bot responses in groups only — private messages are rejected

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **summary-bot** (467 symbols, 577 relationships, 9 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/summary-bot/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/summary-bot/context` | Codebase overview, check index freshness |
| `gitnexus://repo/summary-bot/clusters` | All functional areas |
| `gitnexus://repo/summary-bot/processes` | All execution flows |
| `gitnexus://repo/summary-bot/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
