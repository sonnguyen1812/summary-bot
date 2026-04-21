## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Improved Vietnamese summarization instructions
The `buildSystemPrompt()` function SHALL produce a clearer Vietnamese system prompt that explicitly instructs the AI on output format, language, and what to include or exclude.

#### Scenario: Summary output follows defined format
- **WHEN** the AI generates a summary
- **THEN** the summary SHALL be in Vietnamese
- **THEN** the summary SHALL include key topics, decisions, and notable exchanges
- **THEN** the summary SHALL not include filler phrases or meta-commentary about the summarization process
