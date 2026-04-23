import type { Bot } from "grammy";
import type { FetchedMessage } from "../services/telegram-client.js";
import { askQuestion } from "../services/summarizer.js";
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

    const remaining = rateLimiter.check(chatIdStr);
    if (remaining !== null) {
      await ctx.reply(`Vui lòng chờ ${remaining} giây trước khi hỏi lại.`);
      return;
    }

    // Send loading indicator
    const loadingMsg = await ctx.reply("🔍 Đang tìm kiếm...");
    const loadingMsgId = loadingMsg.message_id;

    rateLimiter.record(chatIdStr);
    try {
      const messages = await telegramClient.fetchMessages(chatId, ASK_FETCH_COUNT);

      const answer = await askQuestion(messages, truncatedQuestion);

      await ctx.api.editMessageText(chatIdStr, loadingMsgId, answer);
    } catch (err) {
      console.error("[Ask] Error:", err);
      try {
        await ctx.api.editMessageText(chatIdStr, loadingMsgId, "Không thể trả lời lúc này. Vui lòng thử lại sau.");
      } catch (editErr) {
        console.warn("[Ask] Failed to edit error message:", editErr);
        await ctx.reply("Không thể trả lời lúc này. Vui lòng thử lại sau.");
      }
    }
  });
}
