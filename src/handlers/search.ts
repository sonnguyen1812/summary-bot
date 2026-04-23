import type { Bot } from "grammy";
import { trackMessage } from "../services/message-tracker.js";
import { webSearch } from "../services/summarizer.js";
import { TELEGRAM_MSG_LIMIT } from "../constants.js";
import { RateLimiter } from "../rate-limiter.js";

const MAX_QUERY_LENGTH = 300;

const rateLimiter = new RateLimiter(10);

export function registerSearchHandler(bot: Bot): void {
  bot.command("search", async (ctx) => {
    if (ctx.chat.type === "private") {
      await ctx.reply("Lệnh này chỉ hoạt động trong group.");
      return;
    }

    const query = ctx.match?.trim();
    if (!query || query.length === 0) {
      await ctx.reply("Sử dụng: /search <câu hỏi>\nVí dụ: /search giá bitcoin hôm nay");
      return;
    }

    const truncatedQuery = query.length > MAX_QUERY_LENGTH
      ? query.slice(0, MAX_QUERY_LENGTH)
      : query;

    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    const remaining = rateLimiter.check(userId);
    if (remaining !== null) {
      await ctx.reply(`Vui lòng chờ ${remaining} giây trước khi tìm kiếm lại.`);
      return;
    }

    const chatId = ctx.chat.id;
    const chatIdStr = chatId.toString();

    const loadingMsg = await ctx.reply("🔍 Đang tìm kiếm...");
    const loadingMsgId = loadingMsg.message_id;
    rateLimiter.record(userId);

    try {
      const result = await webSearch(truncatedQuery);

      // Truncate if over Telegram limit
      const text = result.length > TELEGRAM_MSG_LIMIT
        ? result.slice(0, TELEGRAM_MSG_LIMIT - 3) + "..."
        : result;

      await ctx.api.editMessageText(chatIdStr, loadingMsgId, text);
      trackMessage(chatId, loadingMsgId);
    } catch (err) {
      console.error("[Search] Error:", err);
      try {
        await ctx.api.editMessageText(chatIdStr, loadingMsgId, "Không thể tìm kiếm lúc này. Vui lòng thử lại sau.");
      } catch (editErr) {
        console.warn("[Search] Failed to edit error message:", editErr);
        await ctx.reply("Không thể tìm kiếm lúc này. Vui lòng thử lại sau.");
      }
    }
  });
}
