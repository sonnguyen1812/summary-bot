## ADDED Requirements

### Requirement: Keyword search via /query command
The system SHALL provide a `/query <keyword>` command that searches the group's message history using MTProto server-side search and returns formatted results without AI processing.

#### Scenario: Successful keyword search
- **WHEN** a user sends `/query <keyword>` in a group
- **THEN** the bot SHALL fetch up to 30 matching messages via MTProto search
- **THEN** the bot SHALL reply with results formatted as `[HH:MM DD/MM] username: text snippet`
- **THEN** each result SHALL be on its own line

#### Scenario: No results found
- **WHEN** a user sends `/query <keyword>` and no messages match
- **THEN** the bot SHALL reply with a message indicating no results were found for that keyword

#### Scenario: Missing keyword argument
- **WHEN** a user sends `/query` with no keyword
- **THEN** the bot SHALL reply with usage instructions showing the correct format

#### Scenario: Command used in private chat
- **WHEN** a user sends `/query` in a private chat with the bot
- **THEN** the bot SHALL reject the command and inform the user it only works in groups

#### Scenario: Rate limit enforced
- **WHEN** a user sends `/query` within 10 seconds of their previous `/query`
- **THEN** the bot SHALL silently ignore or reply with a rate limit message

#### Scenario: MTProto search failure
- **WHEN** the MTProto search call throws an error
- **THEN** the bot SHALL reply with a user-friendly error message in Vietnamese
- **THEN** the error SHALL be logged server-side

### Requirement: Result count cap
The system SHALL limit `/query` results to a maximum of 30 messages per search to keep responses readable.

#### Scenario: More than 30 matches exist
- **WHEN** the keyword matches more than 30 messages in the group history
- **THEN** the bot SHALL return only the 30 most recent matches
- **THEN** the reply SHALL indicate the result is capped (e.g., "Showing top 30 results")
