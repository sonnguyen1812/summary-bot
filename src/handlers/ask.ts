import type { Bot } from "grammy";
import type { FetchedMessage } from "../services/telegram-client.js";
import { askQuestion, isQuotaError } from "../services/summarizer.js";
import { addToMemory } from "../services/chat-memory.js";
import { RateLimiter } from "../rate-limiter.js";

interface AskTelegramClient {
  fetchMessages(chatId: number, limit: number): Promise<FetchedMessage[]>;
}

const ASK_FETCH_COUNT = 500;
const MAX_QUESTION_LENGTH = 500;

const rateLimiter = new RateLimiter(30);

export function registerAskHandler(bot: Bot, telegramClient: AskTelegramClient): void {
  bot.command("ask", async (ctx) => {
    if (ctx.chat.type === "private") {
      await ctx.reply("Lệnh này chỉ hoạt động trong group.");
      return;
    }

    const question = ctx.match?.trim();
    if (!question || question.length === 0) {
      await ctx.reply("Sử dụng: /ask <câu hỏi>\nVí dụ: /ask Hôm nay nhóm bàn về chủ đề gì?");
      return;
    }

    const truncatedQuestion = question.length > MAX_QUESTION_LENGTH
      ? question.slice(0, MAX_QUESTION_LENGTH) + "…"
      : question;

    const chatId = ctx.chat.id;
    const chatIdStr = chatId.toString();
    const userId = ctx.from?.id?.toString();
    if (!userId) return;

    const remaining = rateLimiter.check(userId);
    if (remaining !== null) {
      await ctx.reply(`Vui lòng chờ ${remaining} giây trước khi hỏi lại.`);
      return;
    }

    // Send loading indicator
    const loadingMsg = await ctx.reply("💭 Đang phân tích...");
    const loadingMsgId = loadingMsg.message_id;

    rateLimiter.record(userId);
    try {
      const messages = await telegramClient.fetchMessages(chatId, ASK_FETCH_COUNT);

      const answer = await askQuestion(messages, truncatedQuestion);

      addToMemory(chatId, "user", `[/ask] ${truncatedQuestion}`);
      addToMemory(chatId, "assistant", answer);

      await ctx.api.editMessageText(chatIdStr, loadingMsgId, answer);
    } catch (err) {
      console.error("[Ask] Error:", err);
      const errorMsg = isQuotaError(err)
        ? "⚠️ Đã hết lượt gọi AI. Vui lòng thử lại sau vài phút hoặc ngày mai."
        : "Không thể trả lời lúc này. Vui lòng thử lại sau.";
      try {
        await ctx.api.editMessageText(chatIdStr, loadingMsgId, errorMsg);
      } catch (editErr) {
        console.warn("[Ask] Failed to edit error message:", editErr);
        await ctx.reply(errorMsg);
      }
    }
  });
}
