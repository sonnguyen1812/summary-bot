import type { Bot } from "grammy";
import { RateLimiter } from "../rate-limiter.js";
import { splitMessage, withTimeout, MTPROTO_TIMEOUT_MS } from "../utils.js";

interface QueryTelegramClient {
  searchMessages(chatId: number, keyword: string, limit: number): Promise<{ senderName: string; username: string | null; text: string; timestamp: number }[]>;
}

const QUERY_RESULT_LIMIT = 30;
const MAX_KEYWORD_LENGTH = 200;

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

    const truncatedKeyword = keyword.length > MAX_KEYWORD_LENGTH
      ? keyword.slice(0, MAX_KEYWORD_LENGTH)
      : keyword;

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
      const messages = await withTimeout(
        telegramClient.searchMessages(chatId, truncatedKeyword, QUERY_RESULT_LIMIT),
        MTPROTO_TIMEOUT_MS,
        "query.searchMessages"
      );

      if (messages.length === 0) {
        await ctx.reply(`Không tìm thấy tin nhắn nào chứa từ khóa "${truncatedKeyword}".`);
        return;
      }

      const lines = messages.map(formatQueryResult);
      const isCapped = messages.length === QUERY_RESULT_LIMIT;
      const header = isCapped
        ? `🔍 Hiển thị ${QUERY_RESULT_LIMIT} kết quả gần nhất cho "${truncatedKeyword}":\n\n`
        : `🔍 Tìm thấy ${messages.length} kết quả cho "${truncatedKeyword}":\n\n`;

      const body = lines.join("\n");
      const fullText = header + body;

      const parts = splitMessage(fullText);
      for (const part of parts) {
        await ctx.reply(part);
      }
    } catch (err) {
      console.error("[Query] MTProto search error:", err);
      await ctx.reply("Không thể tìm kiếm lúc này. Vui lòng thử lại sau.");
    }
  });
}
