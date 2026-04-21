## ADDED Requirements

### Requirement: Persona prompt expresses natural Vietnamese slang natively
The `CHAT_SYSTEM_PROMPT` in `services/chat.ts` SHALL contain explicit vocabulary examples and sentence-pattern guidance so the AI produces natural Vietnamese slang without requiring regex post-processing.

#### Scenario: AI uses casual vocabulary without post-processing
- **WHEN** the AI generates a reply under the Minh persona
- **THEN** the reply uses casual Vietnamese forms (e.g., "oke", "vậy á", "hiểu rồi", "bro", "tao/mày" register where appropriate)
- **THEN** no regex substitution is needed to convert formal phrasing to casual

#### Scenario: Prompt instructs AI to reference recent chat context
- **WHEN** `<recent_chat>` tags are present in the system prompt
- **THEN** the prompt instructs the AI to reference the recent group conversation when relevant to the user's question
- **THEN** the AI may refer to things said in the group before answering

### Requirement: Random emoticon and filler appender is removed
The portion of `postProcessResponse()` that randomly appends emoticons or filler strings SHALL be removed.

#### Scenario: Response is not modified by the appender
- **WHEN** `postProcessResponse()` is called on any AI response string
- **THEN** no emoticons or filler strings are appended to the end of the response
- **THEN** the output length equals the phrase-substituted AI reply with no additions

### Requirement: Phrase substitution safety net is retained
The phrase substitution mappings in `postProcessResponse()` (replacing formal Vietnamese constructions with casual equivalents) SHALL be retained.

#### Scenario: Formal phrases are still substituted when present
- **WHEN** the AI response contains a known formal phrase mapping (e.g., "Xin chào" → "Ê")
- **THEN** `postProcessResponse()` replaces it with the casual equivalent
- **THEN** outputs that already use casual phrasing pass through unchanged
