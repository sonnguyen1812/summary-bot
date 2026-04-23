import type { Bot } from "grammy";
import { TELEGRAM_MSG_LIMIT } from "../constants.js";
import { RateLimiter } from "../rate-limiter.js";

interface QueryTelegramClient {
  searchMessages(chatId: number, keyword: string, limit: number): Promise<{ senderName: string; username: string | null; text: string; timestamp: number }[]>;
}

const QUERY_RESULT_LIMIT = 30;

const rateLimiter = new RateLimiter(10);

function formatQueryResult(msg: { senderName: string; username: string | null; text: string; timestamp: number }): string {
  const date = new Date(msg.timestamp * 1000);
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  const dd = date.getDate().toString().padStart(2, "0");
  const mo = (date.getMonth() + 1).toString().padStart(2, "0");
  const displayName = msg.username || msg.senderName || "Unknown";
  const snippet = msg.text.length > 200 ? msg.text.slice(0, 200) + "…" : msg.text;
  return `[${hh}:${mm} ${dd}/${mo}] ${displayName}: ${snippet}`;
}

export function registerQueryHandler(bot: Bot, telegramClient: QueryTelegramClient): void {
  bot.command("query", async (ctx) => {
    if (ctx.chat.type === "private") {
      await ctx.reply("Lệnh này chỉ hoạt động trong group.");
      return;
    }

    const keyword = ctx.match?.trim();
    if (!keyword || keyword.length === 0) {
      await ctx.reply("Sử dụng: /query <từ khóa>\nVí dụ: /query họp nhóm");
      return;
    }

    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    const remaining = rateLimiter.check(userId);
    if (remaining !== null) {
      await ctx.reply(`Vui lòng chờ ${remaining} giây trước khi tìm kiếm lại.`);
      return;
    }

    const chatId = ctx.chat.id;

    rateLimiter.record(userId);
    try {
      const messages = await telegramClient.searchMessages(chatId, keyword, QUERY_RESULT_LIMIT);

      if (messages.length === 0) {
        await ctx.reply(`Không tìm thấy tin nhắn nào chứa từ khóa "${keyword}".`);
        return;
      }

      const lines = messages.map(formatQueryResult);
      const isCapped = messages.length === QUERY_RESULT_LIMIT;
      const header = isCapped
        ? `🔍 Hiển thị ${QUERY_RESULT_LIMIT} kết quả gần nhất cho "${keyword}":\n\n`
        : `🔍 Tìm thấy ${messages.length} kết quả cho "${keyword}":\n\n`;

      const body = lines.join("\n");
      const fullText = header + body;

      if (fullText.length <= TELEGRAM_MSG_LIMIT) {
        await ctx.reply(fullText);
      } else {
        // Split into chunks that fit within Telegram's limit
        let remaining = fullText;
        while (remaining.length > 0) {
          if (remaining.length <= TELEGRAM_MSG_LIMIT) {
            await ctx.reply(remaining);
            break;
          }
          let splitAt = remaining.lastIndexOf("\n", TELEGRAM_MSG_LIMIT);
          if (splitAt <= 0) splitAt = TELEGRAM_MSG_LIMIT;
          await ctx.reply(remaining.slice(0, splitAt));
          remaining = remaining.slice(splitAt).trimStart();
        }
      }
    } catch (err) {
      console.error("[Query] MTProto search error:", err);
      await ctx.reply("Không thể tìm kiếm lúc này. Vui lòng thử lại sau.");
    }
  });
}
