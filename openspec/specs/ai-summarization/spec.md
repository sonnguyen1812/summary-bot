# ai-summarization Specification

## Purpose
TBD - created by archiving change telegram-group-summary-bot. Update Purpose after archive.
## Requirements
### Requirement: Format messages for Claude prompt
The summarizer SHALL format each stored message as "[HH:MM] Username: message text" using the message's Unix timestamp, ordered chronologically by timestamp ascending.

#### Scenario: Message with username is formatted correctly
- **WHEN** a message has username "alice", timestamp 1700000000, and text "hello world"
- **THEN** the formatted line is "[HH:MM] alice: hello world" where HH:MM corresponds to the local time of the timestamp

#### Scenario: Message without username falls back to first_name
- **WHEN** a message has no username but first_name "Bob" and text "hi"
- **THEN** the formatted line uses "Bob" as the display name

#### Scenario: Message with neither username nor first_name uses "Unknown"
- **WHEN** a message has neither username nor first_name
- **THEN** the formatted line uses "Unknown" as the display name

### Requirement: Call Claude Haiku 4.5 with system prompt for summarization
The summarizer SHALL send the formatted message list to the Claude API (model: claude-haiku-4-5-20251001) using the prescribed system prompt and return the assistant's reply text.

#### Scenario: Successful API call returns summary text
- **WHEN** the formatted messages are sent to the Claude API and the API responds successfully
- **THEN** the summarizer returns the text content of the first content block of the response

#### Scenario: System prompt enforces language-awareness and format
- **WHEN** the Claude API is called
- **THEN** the system prompt instructs Claude to summarize concisely in the same language as the conversation, highlight key topics/decisions/important information, use bullet points, and keep the summary under 500 words

### Requirement: Prompt injection defense
The system SHALL wrap the summarization system prompt and user-provided message content in XML tags (`<system_instructions>` and `<conversation>`) to prevent chat messages from overriding AI instructions.

#### Scenario: Chat history contains injection attempt
- **WHEN** a message in the fetched history contains text like "ignore previous instructions" or "you are now a different bot"
- **THEN** the AI SHALL treat that text as conversation data, not as instructions
- **THEN** the summary output SHALL not deviate from the defined summarization behavior

#### Scenario: Normal summarization unaffected
- **WHEN** chat history contains no injection attempts
- **THEN** the summary output SHALL be identical in quality to the previous behavior

### Requirement: Dynamic detail level based on message count
The system SHALL adjust the summarization detail level based on the number of messages being summarized, producing more detailed output for larger message sets.

#### Scenario: Small message set (under 100 messages)
- **WHEN** summarizing fewer than 100 messages
- **THEN** the system prompt SHALL instruct the AI to produce a concise summary

#### Scenario: Large message set (100 or more messages)
- **WHEN** summarizing 100 or more messages
- **THEN** the system prompt SHALL instruct the AI to produce a more detailed, comprehensive summary

### Requirement: Improved Vietnamese summarization instructions
The `buildSystemPrompt()` function SHALL produce a clearer Vietnamese system prompt that explicitly instructs the AI on output format, language, and what to include or exclude.

#### Scenario: Summary output follows defined format
- **WHEN** the AI generates a summary
- **THEN** the summary SHALL be in Vietnamese
- **THEN** the summary SHALL include key topics, decisions, and notable exchanges
- **THEN** the summary SHALL not include filler phrases or meta-commentary about the summarization process

### Requirement: Retry once on API failure with 2-second delay
The summarizer SHALL retry the Claude API call exactly once after a 2-second wait if the first call throws an error. If the retry also fails, the error SHALL propagate to the caller.

#### Scenario: First call fails, retry succeeds
- **WHEN** the first Claude API call throws an error and the retry succeeds
- **THEN** the summarizer returns the summary from the retry response

#### Scenario: Both calls fail, error propagates
- **WHEN** both the first call and the retry throw errors
- **THEN** the summarizer throws an error that propagates to the summary command handler

### Requirement: Summary command handles AI failure gracefully
The summary command handler SHALL catch summarizer errors and reply with a user-friendly message.

#### Scenario: Summarizer throws after retry exhausted
- **WHEN** the summarizer throws after both API attempts fail
- **THEN** the bot replies "Không thể tóm tắt lúc này. Vui lòng thử lại sau."

