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

    // Fetch all bot messages + /summary commands via MTProto
    const messageIds = await fetchBotRelatedMessageIds(chatId);

    let deleted = 0;
    for (const msgId of messageIds) {
      try {
        await ctx.api.deleteMessage(chatId, msgId);
        deleted++;
      } catch {
        // Message already deleted or too old — ignore
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
