import type { Bot } from "grammy";
import { trackMessage } from "../services/message-tracker.js";
import { webSearch, isQuotaError } from "../services/summarizer.js";
import { config } from "../config.js";
import { addToMemory } from "../services/chat-memory.js";
import { RateLimiter } from "../rate-limiter.js";
import { splitMessage } from "../utils.js";

const MAX_QUERY_LENGTH = 300;

const rateLimiter = new RateLimiter(10);

export function registerSearchHandler(bot: Bot): void {
  bot.command("search", async (ctx) => {
    if (ctx.chat.type === "private") {
      await ctx.reply("Lệnh này chỉ hoạt động trong group.");
      return;
    }

    if (!config.braveApiKey) {
      await ctx.reply("Tính năng tìm kiếm web chưa được kích hoạt.");
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
      const parts = splitMessage(result);

      addToMemory(chatId, "user", `[/search] ${truncatedQuery}`);
      addToMemory(chatId, "assistant", result);

      await ctx.api.editMessageText(chatIdStr, loadingMsgId, parts[0]);
      trackMessage(chatId, loadingMsgId);

      for (let i = 1; i < parts.length; i++) {
        const sent = await ctx.api.sendMessage(chatIdStr, parts[i]);
        trackMessage(chatId, sent.message_id);
      }
    } catch (err) {
      console.error("[Search] Error:", err);
      const errorMsg = isQuotaError(err)
        ? "⚠️ Đã hết lượt gọi AI. Vui lòng thử lại sau vài phút hoặc ngày mai."
        : "Không thể tìm kiếm lúc này. Vui lòng thử lại sau.";
      try {
        await ctx.api.editMessageText(chatIdStr, loadingMsgId, errorMsg);
      } catch (editErr) {
        console.warn("[Search] Failed to edit error message:", editErr);
        await ctx.reply(errorMsg);
      }
    }
  });
}
