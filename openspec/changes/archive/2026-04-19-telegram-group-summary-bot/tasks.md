## 1. Project Setup

- [x] 1.1 Initialize package.json with name "summary-bot", version "1.0.0", type "module", and scripts: dev (tsx watch src/index.ts), build (tsc), start (node dist/index.js)
- [x] 1.2 Add production dependencies: grammy, better-sqlite3, @anthropic-ai/sdk, dotenv
- [x] 1.3 Add dev dependencies: typescript, @types/better-sqlite3, @types/node, tsx
- [x] 1.4 Create tsconfig.json with target ES2020, module NodeNext, moduleResolution NodeNext, outDir dist, rootDir src, strict true, skipLibCheck true
- [x] 1.5 Create .env.example listing BOT_TOKEN, ANTHROPIC_API_KEY, DEFAULT_MESSAGE_COUNT=50, MAX_MESSAGE_COUNT=500, RATE_LIMIT_SECONDS=30, DB_PATH=./data/messages.db
- [x] 1.6 Create .gitignore excluding node_modules/, dist/, .env, data/ ← (verify: yarn install completes without errors, tsconfig parses correctly with tsc --noEmit on an empty src/index.ts)

## 2. Configuration Module

- [x] 2.1 Create src/config.ts that calls dotenv.config() and reads all six env vars
- [x] 2.2 Throw a descriptive Error if BOT_TOKEN or ANTHROPIC_API_KEY are missing or empty
- [x] 2.3 Parse and export typed config object: botToken (string), anthropicApiKey (string), defaultMessageCount (number, default 50), maxMessageCount (number, default 500), rateLimitSeconds (number, default 30), dbPath (string, default "./data/messages.db") ← (verify: importing config with missing BOT_TOKEN throws; importing with all vars set exports correct typed values)

## 3. Database Service

- [x] 3.1 Create src/services/database.ts and import better-sqlite3 and path/fs modules
- [x] 3.2 Implement initDatabase(): create the data directory at DB_PATH location if it does not exist, open the SQLite connection, run CREATE TABLE IF NOT EXISTS messages with the specified schema, and CREATE INDEX IF NOT EXISTS idx_chat_timestamp
- [x] 3.3 Implement saveMessage(msg): insert a row with chat_id, message_id, user_id, username, first_name, text, message_type, timestamp — wrap in try/catch and log errors without throwing
- [x] 3.4 Implement getRecentMessages(chatId: string, count: number): SELECT the last N rows for the given chat_id ordered by timestamp ASC, return as typed array
- [x] 3.5 Register a process "exit" handler that closes the database connection ← (verify: initDatabase creates table on first run; saveMessage inserts a row; getRecentMessages returns rows in timestamp order)

## 4. Bot Infrastructure

- [x] 4.1 Create src/bot.ts that imports Bot from grammy and config, instantiates the Bot with botToken, registers a bot.catch handler that logs ctx.error to console, and exports the bot instance
- [x] 4.2 Create src/index.ts that imports config, calls initDatabase, imports bot, registers all handlers (message handler and summary command handler), starts long polling with bot.start(), and registers SIGINT/SIGTERM handlers that call bot.stop() then process.exit(0) ← (verify: bot.start() connects to Telegram; SIGINT stops polling and exits cleanly)

## 5. Message Handler

- [x] 5.1 Create src/handlers/message.ts and export a function registerMessageHandler(bot) that calls bot.on("message")
- [x] 5.2 In the listener, skip messages from private chats (chat.type === "private")
- [x] 5.3 Skip service events: if msg.new_chat_members, msg.left_chat_member, msg.pinned_message, or similar service fields are present, return without saving
- [x] 5.4 Determine message_type and text: for text messages use msg.text and type "text"; for photo/video/voice/document/audio/animation/sticker extract the type name and prepend bracket descriptor; append caption if present
- [x] 5.5 If no text and no recognized media type, return without saving
- [x] 5.6 Call saveMessage with chat_id (toString), message_id, user_id (from.id.toString()), username (from.username), first_name (from.first_name), resolved text, message_type, and Date.now()/1000 as timestamp ← (verify: sending a text message to the bot in a group results in a DB row; sending a photo with caption produces "[Photo] caption"; service messages produce no row)

## 6. Summarizer Service

- [x] 6.1 Create src/services/summarizer.ts and instantiate the Anthropic client using config.anthropicApiKey
- [x] 6.2 Implement a formatMessages(messages[]) helper that converts each row to "[HH:MM] DisplayName: text" — use username if available, else first_name, else "Unknown"; derive HH:MM from timestamp * 1000 in local time
- [x] 6.3 Implement summarizeMessages(messages[]): call client.messages.create with model "claude-haiku-4-5-20251001", max_tokens 1024, the system prompt as specified, and a user message containing the formatted message lines joined by newlines
- [x] 6.4 Add retry logic: wrap the API call in a try/catch; on error wait 2000ms and retry once; if the retry also throws, rethrow the error
- [x] 6.5 Return the text content of response.content[0] (ContentBlock of type "text") ← (verify: summarizeMessages with sample messages returns a non-empty string; forcing the first call to fail triggers one retry)

## 7. Summary Command Handler

- [x] 7.1 Create src/handlers/summary.ts with an in-memory rateLimitMap = new Map<string, number>() at module scope
- [x] 7.2 Export registerSummaryHandler(bot) that calls bot.command("summary", handler)
- [x] 7.3 In the handler: if ctx.chat.type === "private", reply "This command only works in groups" and return
- [x] 7.4 Parse the command argument: if present and not a valid integer in [1, config.maxMessageCount], reply "Sử dụng: /summary [số lượng tin nhắn 1-500]" and return; default to config.defaultMessageCount if no argument
- [x] 7.5 Check rate limit: if rateLimitMap has the chat_id and (Date.now()/1000 - lastTime) < config.rateLimitSeconds, reply with remaining seconds and return; otherwise update rateLimitMap with current time
- [x] 7.6 Call getRecentMessages(chatId, count) in a try/catch; on DB error reply "Lỗi truy xuất tin nhắn." and return
- [x] 7.7 If messages array is empty, reply "Chưa có tin nhắn nào để tóm tắt. Bot cần thời gian để thu thập tin nhắn." and return
- [x] 7.8 Call summarizeMessages(messages); on error reply "Không thể tóm tắt lúc này. Vui lòng thử lại sau." and return
- [x] 7.9 Reply with the summary text ← (verify: /summary in private replies correctly; /summary abc replies validation error; /summary within 30s of previous replies cooldown; /summary with stored messages returns summary text)

## 8. Integration Smoke Test

- [x] 8.1 Run yarn build (tsc) and confirm zero TypeScript errors
- [ ] 8.2 Start the bot with yarn dev, add it to a test group, send several messages, then run /summary and confirm a summary is returned in the group ← (verify: end-to-end flow works — messages stored in DB, /summary fetches them, Claude responds, bot replies in group)
