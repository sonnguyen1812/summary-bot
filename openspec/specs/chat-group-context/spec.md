## ADDED Requirements

### Requirement: Fetch recent group messages before AI call
When the chat handler receives an @mention or reply-to-bot event in a group, it SHALL fetch the last 50 messages from that group via the MTProto client before invoking the AI.

#### Scenario: Successful fetch provides context
- **WHEN** a user @mentions the bot in a group chat
- **THEN** the handler fetches the last 50 messages from the group via `telegramClient.fetchMessages(chatId, 50)`
- **THEN** the fetched messages are formatted as `[HH:MM] username: text` lines
- **THEN** the formatted string is passed as `groupContext` to `chatWithAI()`

#### Scenario: MTProto fetch failure causes graceful degradation
- **WHEN** `telegramClient.fetchMessages()` throws an error
- **THEN** the error is caught and logged as a warning
- **THEN** `groupContext` is set to `undefined`
- **THEN** `chatWithAI()` is still called and the AI replies without group context
- **THEN** no error is surfaced to the user

### Requirement: ChatTelegramClient interface decouples handler from concrete client
The chat handler SHALL accept a `ChatTelegramClient` interface parameter rather than a concrete MTProto client instance.

#### Scenario: Interface is satisfied by the concrete client at call site
- **WHEN** `registerChatHandler(bot, { fetchMessages })` is called in `index.ts`
- **THEN** the concrete `fetchMessages` function from `telegram-client.ts` satisfies the interface
- **THEN** no adapter or wrapper is required

### Requirement: Group context injected into system prompt with XML tags
When `groupContext` is provided, `chatWithAI()` SHALL append it to the system prompt inside `<recent_chat>...</recent_chat>` XML delimiters.

#### Scenario: Context appears in system prompt when provided
- **WHEN** `chatWithAI()` is called with a non-empty `groupContext` string
- **THEN** the system prompt sent to the Anthropic API contains `<recent_chat>\n{groupContext}\n</recent_chat>`
- **THEN** the content appears after the base persona prompt

#### Scenario: System prompt unchanged when context is absent
- **WHEN** `chatWithAI()` is called with `groupContext` undefined or omitted
- **THEN** the system prompt contains no `<recent_chat>` tags
- **THEN** behavior is identical to the pre-change implementation

### Requirement: Message formatting matches summarizer pattern
Fetched messages SHALL be formatted as `[HH:MM] displayName: text` (same convention as `formatMessages()` in `summarizer.ts`).

#### Scenario: Formatted output uses correct timestamp and name fields
- **WHEN** a fetched message has `date` (Unix timestamp), `sender`, and `text` fields
- **THEN** the formatted line is `[HH:MM] sender: text` using the local hour and minute of the message timestamp
- **THEN** messages with empty or missing text are skipped
