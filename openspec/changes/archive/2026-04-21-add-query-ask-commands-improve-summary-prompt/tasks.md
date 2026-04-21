## 1. MTProto Service Extension

- [x] 1.1 Add `searchMessages(chatId, keyword, limit)` method to `src/services/telegram-client.ts` using `client.getMessages(chatId, { search: keyword, limit })` ← (verify: method returns GramJS Message array, handles errors gracefully, integrates with existing client lifecycle)

## 2. /query Handler

- [x] 2.1 Create `src/handlers/query.ts` with `registerQueryHandler(bot, telegramClient)` export
- [x] 2.2 Validate group-only and keyword-required guards, reply with usage hint if missing
- [x] 2.3 Call `telegramClient.searchMessages(chatId, keyword, 30)` and format results as `[HH:MM DD/MM] username: text`
- [x] 2.4 Handle empty results with a "no results found" reply in Vietnamese
- [x] 2.5 Handle MTProto errors with a user-friendly Vietnamese error message
- [x] 2.6 Add per-user 10s rate limit reusing existing rate limiter pattern ← (verify: all scenarios in keyword-search/spec.md pass — empty keyword, no results, rate limit, private chat rejection, error handling)

## 3. Summarizer Service Extension

- [x] 3.1 Add `askQuestion(messages, question)` function to `src/services/summarizer.ts` reusing the existing Anthropic client
- [x] 3.2 Implement the 3-message prompt structure: system (Vietnamese QA instructions), user (formatted history), user (question)
- [x] 3.3 Apply XML-tag wrapping (`<conversation>`) around the formatted history in the user message
- [x] 3.4 Reuse `isInvalidResponse` guard and retry logic from `summarizeMessages()`
- [x] 3.5 Improve `buildSystemPrompt()` to wrap system instructions in `<system_instructions>` XML tags and wrap the messages block in `<conversation>` tags when assembling the final Anthropic call ← (verify: prompt injection test — message containing "ignore previous instructions" does not alter summary output; XML tags present in assembled prompt)

## 4. /ask Handler

- [x] 4.1 Create `src/handlers/ask.ts` with `registerAskHandler(bot, telegramClient)` export
- [x] 4.2 Validate group-only and question-required guards, reply with usage hint if missing
- [x] 4.3 Send a Vietnamese loading message ("Đang tìm kiếm...") and store the message ID
- [x] 4.4 Call `telegramClient.fetchMessages(chatId, 500)` then `askQuestion(messages, question)`
- [x] 4.5 Edit the loading message with the AI answer; on error, edit with a Vietnamese error message
- [x] 4.6 Add per-chat 30s rate limit reusing existing rate limiter pattern ← (verify: all scenarios in chat-qa/spec.md pass — missing question, rate limit, private chat rejection, answer cites history, language matching, error handling)

## 5. Handler Registration

- [x] 5.1 Import and call `registerQueryHandler` in `src/index.ts` after `registerClearHandler` and before `registerChatHandler`
- [x] 5.2 Import and call `registerAskHandler` in `src/index.ts` after `registerQueryHandler` and before `registerChatHandler`
- [x] 5.3 Add `/query` and `/ask` to the bot command list (via `bot.api.setMyCommands()` or BotFather) ← (verify: handler registration order is correct — /query and /ask commands are not intercepted by the chat handler; commands appear in Telegram's command menu)

## 6. Summarization Prompt Improvement

- [x] 6.1 Update `buildSystemPrompt()` in `src/services/summarizer.ts` to produce clearer Vietnamese instructions covering: output format, language, what to include (key topics, decisions, notable exchanges), what to exclude (filler, meta-commentary)
- [x] 6.2 Verify dynamic detail level logic still adjusts based on message count threshold (< 100 vs >= 100) ← (verify: summarization/spec.md MODIFIED requirements satisfied — XML wrapping present, dynamic detail level works, Vietnamese output quality improved)
