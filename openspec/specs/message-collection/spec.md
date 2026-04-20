# message-collection Specification

## Purpose
TBD - created by archiving change telegram-group-summary-bot. Update Purpose after archive.
## Requirements
### Requirement: Store text messages from groups
The bot SHALL listen to all incoming messages in Telegram groups and supergroups and persist text messages to the SQLite database with full metadata.

#### Scenario: Text message in group is saved
- **WHEN** a text message is received in a group or supergroup
- **THEN** the bot saves chat_id, message_id, user_id, username, first_name, the full message text, message_type="text", and a Unix timestamp to the messages table

#### Scenario: Message from private chat is ignored
- **WHEN** a text message is received in a private chat
- **THEN** the bot does NOT save it to the messages table

### Requirement: Store media messages with type descriptors
The bot SHALL store media messages using a bracketed type descriptor, optionally appended with the caption if one exists.

#### Scenario: Photo without caption is stored as descriptor
- **WHEN** a photo message with no caption is received in a group
- **THEN** the bot saves text="[Photo]" and message_type="photo"

#### Scenario: Photo with caption is stored as descriptor plus caption
- **WHEN** a photo message with caption "check this out" is received in a group
- **THEN** the bot saves text="[Photo] check this out" and message_type="photo"

#### Scenario: Sticker message is stored with descriptor
- **WHEN** a sticker message is received in a group
- **THEN** the bot saves text="[Sticker]" and message_type="sticker"

#### Scenario: Video, Voice, Document, Audio, Animation are stored with descriptors
- **WHEN** any of Video, Voice, Document, Audio, or Animation messages are received in a group
- **THEN** the bot saves the appropriate descriptor ([Video], [Voice], [Document], [Audio], [Animation]) and the corresponding message_type value

### Requirement: Skip service and empty messages
The bot SHALL NOT store service messages (member join/leave, pinned messages, etc.) or messages with no meaningful content.

#### Scenario: Member join event is skipped
- **WHEN** a new_chat_members event is received
- **THEN** the bot does not insert any record into the messages table

#### Scenario: Message with no text and no recognized media type is skipped
- **WHEN** a message arrives that has neither text nor a recognized media attachment
- **THEN** the bot does not insert any record into the messages table

### Requirement: Database write errors do not crash the bot
The bot SHALL log database write errors to the console and continue processing subsequent messages without terminating.

#### Scenario: SQLite insert fails
- **WHEN** a database write error occurs while saving a message
- **THEN** the error is logged to the console and the bot remains running and continues to process the next message

