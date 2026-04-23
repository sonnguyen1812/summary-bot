import type { Bot } from "grammy";
import { trackMessage } from "../services/message-tracker.js";
import { webSearch } from "../services/summarizer.js";

const SEARCH_RATE_LIMIT_SECONDS = 10;
const TELEGRAM_MSG_LIMIT = 4096;

const rateLimitMap = new Map<string, number>();

function isRateLimited(userId: string): number | null {
  const now = Date.now() / 1000;
  const lastTime = rateLimitMap.get(userId);
  if (lastTime !== undefined) {
    const elapsed = now - lastTime;
    if (elapsed < SEARCH_RATE_LIMIT_SECONDS) {
      return Math.ceil(SEARCH_RATE_LIMIT_SECONDS - elapsed);
    }
  }
  return null;
}

function recordRateLimit(userId: string): void {
  rateLimitMap.set(userId, Date.now() / 1000);
  if (rateLimitMap.size > 1000) {
    const now = Date.now() / 1000;
    for (const [key, timestamp] of rateLimitMap) {
      if (now - timestamp > SEARCH_RATE_LIMIT_SECONDS) {
        rateLimitMap.delete(key);
      }
    }
  }
}

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

    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    const remaining = isRateLimited(userId);
    if (remaining !== null) {
      await ctx.reply(`Vui lòng chờ ${remaining} giây trước khi tìm kiếm lại.`);
      return;
    }

    const chatId = ctx.chat.id;
    const chatIdStr = chatId.toString();

    const loadingMsg = await ctx.reply("🔍 Đang tìm kiếm...");
    const loadingMsgId = loadingMsg.message_id;
    recordRateLimit(userId);

    try {
      const result = await webSearch(query);

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
