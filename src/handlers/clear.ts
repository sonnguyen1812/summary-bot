import type { Bot } from "grammy";
import { clearTracked } from "../services/message-tracker.js";
import { fetchBotRelatedMessageIds } from "../services/telegram-client.js";

export function registerClearHandler(bot: Bot): void {
  bot.command("clear", async (ctx) => {
    if (ctx.chat.type === "private") {
      await ctx.reply("Lệnh này chỉ hoạt động trong group.");
      return;
    }

    const chatId = ctx.chat.id;
    const clearCmdId = ctx.message?.message_id;

    // Fetch all bot messages + command messages via MTProto
    const messageIds = await fetchBotRelatedMessageIds(chatId);

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
