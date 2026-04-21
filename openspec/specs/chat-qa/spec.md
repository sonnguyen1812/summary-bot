# chat-qa Specification

## Purpose
AI Q&A command that fetches recent chat history via MTProto and answers user questions using the Anthropic API.

## Requirements

### Requirement: AI Q&A via /ask command
The system SHALL provide an `/ask <question>` command that fetches recent chat history via MTProto and uses the Anthropic API to answer the user's question in-group.

#### Scenario: Successful question answered
- **WHEN** a user sends `/ask <question>` in a group
- **THEN** the bot SHALL send a loading indicator message
- **THEN** the bot SHALL fetch the last 500 messages via MTProto
- **THEN** the bot SHALL send the formatted history and question to Anthropic
- **THEN** the bot SHALL edit the loading message with the AI-generated answer

#### Scenario: Missing question argument
- **WHEN** a user sends `/ask` with no question text
- **THEN** the bot SHALL reply with usage instructions showing the correct format

#### Scenario: Command used in private chat
- **WHEN** a user sends `/ask` in a private chat with the bot
- **THEN** the bot SHALL reject the command and inform the user it only works in groups

#### Scenario: Rate limit enforced per chat
- **WHEN** `/ask` is invoked in a chat within 30 seconds of the previous `/ask` in that same chat
- **THEN** the bot SHALL reply with a rate limit message indicating when the next request is allowed

#### Scenario: Anthropic API failure
- **WHEN** the Anthropic API call fails or returns an invalid response
- **THEN** the bot SHALL edit the loading message with a user-friendly error in Vietnamese
- **THEN** the error SHALL be logged server-side

#### Scenario: Answer references chat history
- **WHEN** the question can be answered from the fetched messages
- **THEN** the AI response SHALL cite relevant messages as evidence
- **THEN** the response SHALL be in the same language as the question

#### Scenario: Information not found in history
- **WHEN** the question cannot be answered from the fetched messages
- **THEN** the AI SHALL explicitly state that the information was not found in recent chat history

### Requirement: Prompt injection defense for /ask
The system SHALL use XML-tag separation to prevent user-supplied chat content from overriding system instructions.

#### Scenario: Chat history contains injection attempt
- **WHEN** a message in the fetched history contains text like "ignore previous instructions"
- **THEN** the AI SHALL treat that text as data, not as instructions
- **THEN** the response SHALL not deviate from the defined assistant behavior

### Requirement: /ask system prompt in Vietnamese
The system prompt for `/ask` SHALL instruct the AI in Vietnamese to answer based on chat history, cite evidence, respond in the questioner's language, and keep answers concise.

#### Scenario: Question asked in Vietnamese
- **WHEN** a user asks a question in Vietnamese
- **THEN** the AI SHALL respond in Vietnamese

#### Scenario: Question asked in English
- **WHEN** a user asks a question in English
- **THEN** the AI SHALL respond in English
