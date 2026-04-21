import type { Bot } from "grammy";
import type { FetchedMessage } from "../services/telegram-client.js";
import { askQuestion } from "../services/summarizer.js";

interface AskTelegramClient {
  fetchMessages(chatId: number, limit: number): Promise<FetchedMessage[]>;
}

const ASK_RATE_LIMIT_SECONDS = 30;
const ASK_FETCH_COUNT = 500;

const rateLimitMap = new Map<string, number>();

function isRateLimited(chatId: string): number | null {
  const now = Date.now() / 1000;
  const lastTime = rateLimitMap.get(chatId);
  if (lastTime !== undefined) {
    const elapsed = now - lastTime;
    if (elapsed < ASK_RATE_LIMIT_SECONDS) {
      return Math.ceil(ASK_RATE_LIMIT_SECONDS - elapsed);
    }
  }
  return null;
}

function recordRateLimit(chatId: string): void {
  rateLimitMap.set(chatId, Date.now() / 1000);
  if (rateLimitMap.size > 1000) {
    const now = Date.now() / 1000;
    for (const [key, timestamp] of rateLimitMap) {
      if (now - timestamp > ASK_RATE_LIMIT_SECONDS) {
        rateLimitMap.delete(key);
      }
    }
  }
}

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

    const chatId = ctx.chat.id;
    const chatIdStr = chatId.toString();

    const remaining = isRateLimited(chatIdStr);
    if (remaining !== null) {
      await ctx.reply(`Vui lòng chờ ${remaining} giây trước khi hỏi lại.`);
      return;
    }

    // Send loading indicator
    const loadingMsg = await ctx.reply("🔍 Đang tìm kiếm...");
    const loadingMsgId = loadingMsg.message_id;

    try {
      const messages = await telegramClient.fetchMessages(chatId, ASK_FETCH_COUNT);
      recordRateLimit(chatIdStr);

      const answer = await askQuestion(messages, question);

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
