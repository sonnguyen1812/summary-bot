# bot-infrastructure Specification

## Purpose
TBD - created by archiving change telegram-group-summary-bot. Update Purpose after archive.
## Requirements
### Requirement: Load and validate configuration from environment variables
The config module SHALL read all configuration values from environment variables, apply defaults where specified, and throw a descriptive error at startup if any required variable is missing.

#### Scenario: BOT_TOKEN missing causes startup failure
- **WHEN** the process starts without BOT_TOKEN set in the environment
- **THEN** the config module throws an error with a message indicating BOT_TOKEN is required

#### Scenario: ANTHROPIC_API_KEY missing causes startup failure
- **WHEN** the process starts without ANTHROPIC_API_KEY set in the environment
- **THEN** the config module throws an error with a message indicating ANTHROPIC_API_KEY is required

#### Scenario: Optional variables use defaults when not set
- **WHEN** DEFAULT_MESSAGE_COUNT, MAX_MESSAGE_COUNT, RATE_LIMIT_SECONDS, and DB_PATH are not set
- **THEN** the config exports 50, 500, 30, and "./data/messages.db" respectively

### Requirement: Initialize SQLite database on startup
The database service SHALL create the data directory and messages table (with index) if they do not already exist when initDatabase() is called.

#### Scenario: First run creates table and index
- **WHEN** initDatabase() is called and no database file exists at DB_PATH
- **THEN** the messages table and idx_chat_timestamp index are created, and subsequent calls to saveMessage succeed

#### Scenario: Subsequent runs do not fail if table already exists
- **WHEN** initDatabase() is called and the messages table already exists
- **THEN** no error is thrown and the existing data is preserved

### Requirement: Graceful shutdown on SIGINT and SIGTERM
The entry point SHALL register handlers for SIGINT and SIGTERM that stop the bot's long polling and close the database connection before the process exits.

#### Scenario: SIGINT received stops bot and closes DB
- **WHEN** the process receives SIGINT (e.g., Ctrl-C)
- **THEN** bot.stop() is called, the database connection is closed, and the process exits cleanly

#### Scenario: SIGTERM received stops bot and closes DB
- **WHEN** the process receives SIGTERM
- **THEN** bot.stop() is called, the database connection is closed, and the process exits cleanly

### Requirement: Bot error handler logs errors without crashing
The bot instance SHALL have a global error handler registered that logs errors to the console and does not terminate the process.

#### Scenario: Handler throws an unhandled error
- **WHEN** a message or command handler throws an exception that is not caught internally
- **THEN** grammY's error handler logs the error to the console and the bot continues processing subsequent updates

