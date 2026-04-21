## 1. Update `services/chat.ts`

- [x] 1.1 Add optional `groupContext?: string` parameter to the `chatWithAI()` function signature
- [x] 1.2 When `groupContext` is provided, append `<recent_chat>\n{groupContext}\n</recent_chat>` to the system prompt string before the Anthropic API call
- [x] 1.3 Rewrite `CHAT_SYSTEM_PROMPT` — give Minh a vivid personality description, embed explicit casual Vietnamese vocabulary examples, and add an instruction to reference `<recent_chat>` context when relevant
- [x] 1.4 Remove the randomized emoticon/filler appending block from `postProcessResponse()` while keeping all phrase-substitution mappings ← (verify: `postProcessResponse()` no longer appends any suffix, phrase substitutions still apply, and the function signature is unchanged)

## 2. Update `handlers/chat.ts`

- [x] 2.1 Define the `ChatTelegramClient` interface: `{ fetchMessages(chatId: number, limit: number): Promise<FetchedMessage[]> }`
- [x] 2.2 Change `registerChatHandler(bot: Bot)` to `registerChatHandler(bot: Bot, telegramClient: ChatTelegramClient)`
- [x] 2.3 Before the AI call, fetch last 50 messages: `await telegramClient.fetchMessages(chatId, 50)`
- [x] 2.4 Format fetched messages as `[HH:MM] username: text` lines (skip messages with empty text), join into a single string as `groupContext`
- [x] 2.5 Wrap the fetch and format in a try/catch — on error log a warning and set `groupContext = undefined`
- [x] 2.6 Pass `groupContext` to `chatWithAI()` ← (verify: AI call includes group context when MTProto succeeds, and proceeds without context when MTProto throws; bot reply is sent in both cases)

## 3. Update `index.ts`

- [x] 3.1 Change `registerChatHandler(bot)` to `registerChatHandler(bot, { fetchMessages })` — no new imports needed ← (verify: bot starts without TypeScript errors, chat handler fires correctly on @mention and reply-to-bot)
