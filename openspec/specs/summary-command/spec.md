# summary-command Specification

## Purpose
TBD - created by archiving change telegram-group-summary-bot. Update Purpose after archive.
## Requirements
### Requirement: Summary command works only in groups
The bot SHALL reject /summary invocations in private chats with an informative message.

#### Scenario: /summary in private chat
- **WHEN** a user sends /summary in a private chat
- **THEN** the bot replies "This command only works in groups"

#### Scenario: /summary in a group chat proceeds
- **WHEN** a user sends /summary in a group or supergroup
- **THEN** the bot proceeds with the summarization flow

### Requirement: Parse optional message count argument
The bot SHALL accept an optional integer argument N (1-500) after /summary and default to 50 when no argument is provided.

#### Scenario: /summary with no argument uses default count
- **WHEN** a user sends /summary with no argument
- **THEN** the bot fetches the last 50 messages for the current chat

#### Scenario: /summary 100 fetches 100 messages
- **WHEN** a user sends /summary 100
- **THEN** the bot fetches the last 100 messages for the current chat

#### Scenario: /summary with invalid argument is rejected
- **WHEN** a user sends /summary abc or /summary 0 or /summary 501
- **THEN** the bot replies "Sử dụng: /summary [số lượng tin nhắn 1-500]"

### Requirement: Per-chat rate limiting of 30 seconds
The bot SHALL enforce a cooldown of 30 seconds between /summary invocations per chat. If rate-limited, it SHALL reply with the remaining cooldown time.

#### Scenario: First summary request in a chat proceeds immediately
- **WHEN** a user sends /summary and no previous summary has been requested in that chat
- **THEN** the bot proceeds with summarization

#### Scenario: Second request within cooldown is rejected with time remaining
- **WHEN** a user sends /summary within 30 seconds of a prior summary in the same chat
- **THEN** the bot replies indicating how many seconds remain before the next summary is allowed

#### Scenario: Request after cooldown expires proceeds
- **WHEN** a user sends /summary more than 30 seconds after the previous summary in the same chat
- **THEN** the bot proceeds with summarization

### Requirement: Reply with summary or appropriate error message
The bot SHALL reply in the group with the summary text, or with a specific message when no messages are found or a database error occurs.

#### Scenario: Messages found, summary returned
- **WHEN** messages exist in the database for the chat and summarization succeeds
- **THEN** the bot replies with the formatted summary text

#### Scenario: No messages found
- **WHEN** the database has no messages for the current chat_id
- **THEN** the bot replies "Chưa có tin nhắn nào để tóm tắt. Bot cần thời gian để thu thập tin nhắn."

#### Scenario: Database read error
- **WHEN** the database query fails
- **THEN** the bot replies "Lỗi truy xuất tin nhắn."

