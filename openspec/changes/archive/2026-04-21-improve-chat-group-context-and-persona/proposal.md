## Why

The bot's @mention/reply chat feature gives low-quality answers because the AI has no awareness of the group's recent conversation — it responds in a vacuum. The "Minh" persona also relies on fragile regex post-processing to inject Vietnamese slang, which produces unnatural results and is hard to maintain.

## What Changes

- `src/services/chat.ts`: `chatWithAI()` accepts an optional `groupContext?: string` parameter; when provided it is injected into the system prompt inside `<recent_chat>...</recent_chat>` XML tags. The `CHAT_SYSTEM_PROMPT` is rewritten for a more vivid, natural "Minh" persona with slang baked in directly. Random emoticon/filler appending in `postProcessResponse()` is removed; phrase replacements are kept as a safety net.
- `src/handlers/chat.ts`: `registerChatHandler()` gains a second parameter `telegramClient: ChatTelegramClient`. Before each AI call the handler fetches the last 50 group messages via MTProto, formats them as `[HH:MM] username: text`, and passes them as `groupContext`. MTProto errors are caught and result in graceful degradation (context omitted).
- `src/index.ts`: `registerChatHandler(bot)` call updated to `registerChatHandler(bot, { fetchMessages })` — no new imports needed since `fetchMessages` is already in scope.

## Capabilities

### New Capabilities

- `chat-group-context`: Inject recent group message history into the AI system prompt before answering @mention/reply queries, giving the AI awareness of ongoing conversation.
- `chat-persona-rewrite`: Rewrite the "Minh" chat persona system prompt with natural Vietnamese slang baked in and remove the fragile regex post-processing appender.

### Modified Capabilities

<!-- No existing openspec specs are affected — this is a new change targeting an existing feature with no prior specs. -->

## Impact

- `src/services/chat.ts` — signature change to `chatWithAI()`, system prompt rewrite, `postProcessResponse()` partial removal
- `src/handlers/chat.ts` — signature change to `registerChatHandler()`, new MTProto fetch + format logic
- `src/index.ts` — one-line call-site update
- No external API changes, no new dependencies, no schema or storage changes
