## ADDED Requirements

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
