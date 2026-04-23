import type { Bot } from "grammy";
import { clearTracked } from "../services/message-tracker.js";
import { RateLimiter } from "../rate-limiter.js";

interface ClearTelegramClient {
  fetchBotRelatedMessageIds(chatId: number): Promise<number[]>;
}

const rateLimiter = new RateLimiter(30);

export function registerClearHandler(bot: Bot, telegramClient: ClearTelegramClient): void {
  bot.command("clear", async (ctx) => {
    if (ctx.chat.type === "private") {
      await ctx.reply("Lệnh này chỉ hoạt động trong group.");
      return;
    }

    const chatId = ctx.chat.id;
    const userId = ctx.from?.id;
    if (!userId) return;

    // Admin-only check
    try {
      const member = await ctx.api.getChatMember(chatId, userId);
      if (member.status !== "administrator" && member.status !== "creator") {
        await ctx.reply("Chỉ admin mới có thể xóa tin nhắn bot.");
        return;
      }
    } catch (err) {
      console.warn("[Clear] Failed to check admin status:", err);
      await ctx.reply("Không thể kiểm tra quyền admin. Vui lòng thử lại sau.");
      return;
    }

    const remaining = rateLimiter.check(userId.toString());
    if (remaining !== null) {
      await ctx.reply(`Vui lòng chờ ${remaining} giây trước khi dùng lệnh này lại.`);
      return;
    }

    const clearCmdId = ctx.message?.message_id;
    rateLimiter.record(userId.toString());

    // Fetch all bot messages + command messages via MTProto
    const messageIds = await telegramClient.fetchBotRelatedMessageIds(chatId);

    let deleted = 0;
    // Telegram supports deleting up to 100 messages at once
    for (let i = 0; i < messageIds.length; i += 100) {
      const batch = messageIds.slice(i, i + 100);
      try {
        await ctx.api.raw.deleteMessages({ chat_id: chatId, message_ids: batch });
        deleted += batch.length;
      } catch {
        // Fallback to individual deletes if batch fails
        for (const msgId of batch) {
          try {
            await ctx.api.deleteMessage(chatId, msgId);
            deleted++;
          } catch {
            // Message already deleted or too old
          }
        }
      }
    }

    // Delete the /clear command itself
    if (clearCmdId) {
      try {
        await ctx.api.deleteMessage(chatId, clearCmdId);
      } catch {}
    }

    clearTracked(chatId);

    // Send confirmation, auto-delete after 5s
    const confirmText = deleted > 0 ? `Đã xóa ${deleted} tin nhắn.` : "Không có tin nhắn nào để xóa.";
    const confirmMsg = await ctx.reply(confirmText);
    setTimeout(async () => {
      try { await ctx.api.deleteMessage(chatId, confirmMsg.message_id); } catch {}
    }, 5000);
  });
}
