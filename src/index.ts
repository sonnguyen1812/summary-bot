import { createServer } from "http";
import { config } from "./config.js";
import { bot } from "./bot.js";
import { initTelegramClient, disconnectTelegramClient, fetchMessages, searchMessages } from "./services/telegram-client.js";
import { registerSummaryHandler } from "./handlers/summary.js";
import { registerClearHandler } from "./handlers/clear.js";
import { registerQueryHandler } from "./handlers/query.js";
import { registerAskHandler } from "./handlers/ask.js";
import { registerChatHandler } from "./handlers/chat.js";

// Health check HTTP server for Fly.io (keeps machine alive)
const PORT = parseInt(process.env.PORT || "8080", 10);
const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("ok");
});
server.listen(PORT, () => {
  console.log(`[Health] Listening on port ${PORT}`);
});

// Initialize MTProto client
await initTelegramClient();
console.log("[Bot] MTProto client initialized.");

// Register handlers (command handlers first, then message handlers)
registerSummaryHandler(bot);
registerClearHandler(bot);
registerQueryHandler(bot, { searchMessages });
registerAskHandler(bot, { fetchMessages });
registerChatHandler(bot, { fetchMessages });
console.log("[Bot] Handlers registered.");

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`[Bot] Received ${signal}, shutting down...`);
  await bot.stop();
  await disconnectTelegramClient();
  server.close();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

// Register bot commands for Telegram menu
bot.api.setMyCommands([
  { command: "summary", description: "Tóm tắt trò chuyện (VD: /summary 100, /summary 12h, /summary 1d)" },
  { command: "query", description: "Tìm kiếm tin nhắn theo từ khóa (VD: /query họp nhóm)" },
  { command: "ask", description: "Hỏi AI về nội dung trò chuyện (VD: /ask Hôm nay bàn gì?)" },
  { command: "clear", description: "Xóa tin nhắn bot và lệnh /summary" },
]).then(() => {
  console.log("[Bot] Commands registered.");
}).catch((err) => {
  console.error("[Bot] Failed to register commands:", err);
});

// Start polling
console.log("[Bot] Starting long polling...");
bot.start().catch((err) => {
  console.error("[Bot] Fatal error:", err);
  process.exit(1);
});
