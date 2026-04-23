import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { config } from "../config.js";
import { fetchMessages, fetchMessagesSince } from "../services/telegram-client.js";
import { summarizeMessages, isQuotaError, type SummaryMeta } from "../services/summarizer.js";
import { trackMessage } from "../services/message-tracker.js";
import { TELEGRAM_MSG_LIMIT } from "../constants.js";
import { RateLimiter } from "../rate-limiter.js";

function splitMessage(text: string): string[] {
  if (text.length <= TELEGRAM_MSG_LIMIT) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= TELEGRAM_MSG_LIMIT) {
      parts.push(remaining);
      break;
    }
    // Try to split at last newline before limit
    let splitAt = remaining.lastIndexOf("\n", TELEGRAM_MSG_LIMIT);
    if (splitAt <= 0) splitAt = TELEGRAM_MSG_LIMIT;
    parts.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  return parts;
}

const rateLimiter = new RateLimiter(config.rateLimitSeconds);
const pendingKeyboards = new Map<string, ReturnType<typeof setTimeout>>();

type SummaryQuery =
  | { type: "count"; count: number; label: string }
  | { type: "time"; sinceTimestamp: number; label: string };

function parseQuery(arg: string): SummaryQuery | null {
  if (/^\d+$/.test(arg)) {
    const n = parseInt(arg, 10);
    if (n < 1 || n > config.maxMessageCount) return null;
    return { type: "count", count: n, label: `${n} tin nhắn gần nhất` };
  }
  const timeMatch = arg.match(/^(\d+)(h|d)$/i);
  if (!timeMatch) return null;
  const value = parseInt(timeMatch[1], 10);
  const unit = timeMatch[2].toLowerCase();
  let totalHours: number;
  let label: string;
  if (unit === "h") {
    if (value < 1 || value > 72) return null;
    totalHours = value;
    label = `${value} giờ qua`;
  } else {
    if (value < 1 || value > 3) return null;
    totalHours = value * 24;
    label = `${value} ngày qua`;
  }
  const sinceTimestamp = Math.floor(Date.now() / 1000) - totalHours * 3600;
  return { type: "time", sinceTimestamp, label };
}

function formatTimeRange(messages: { timestamp: number }[]): string {
  if (messages.length === 0) return "";
  const first = new Date(messages[0].timestamp * 1000);
  const last = new Date(messages[messages.length - 1].timestamp * 1000);

  const fmt = (d: Date) => {
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    const dd = d.getDate().toString().padStart(2, "0");
    const mo = (d.getMonth() + 1).toString().padStart(2, "0");
    return `${hh}:${mm} ${dd}/${mo}`;
  };

  return `${fmt(first)} → ${fmt(last)}`;
}

async function executeSummary(
  chatId: number,
  query: SummaryQuery,
): Promise<string> {
  let messages;
  if (query.type === "count") {
    messages = await fetchMessages(chatId, query.count);
  } else {
    messages = await fetchMessagesSince(chatId, query.sinceTimestamp, config.maxMessageCount);
  }

  if (messages.length === 0) {
    return "Chưa có tin nhắn nào để tóm tắt.";
  }

  const meta: SummaryMeta = {
    messageCount: messages.length,
    mode: query.label,
    timeRange: formatTimeRange(messages),
  };

  return await summarizeMessages(messages, meta);
}

export function registerSummaryHandler(bot: Bot): void {
  bot.command("summary", async (ctx) => {
    if (ctx.chat.type === "private") {
      await ctx.reply("Lệnh này chỉ hoạt động trong group.");
      return;
    }

    const chatId = ctx.chat.id;
    const chatIdStr = chatId.toString();

    if (ctx.message) trackMessage(chatId, ctx.message.message_id);

    const argStr = ctx.match?.trim();

    if (argStr && argStr.length > 0) {
      const query = parseQuery(argStr);
      if (!query) {
        const usageReply = await ctx.reply(
          "Sử dụng: /summary [số | thời gian]\nVí dụ: /summary 100, /summary 12h, /summary 1d"
        );
        trackMessage(chatId, usageReply.message_id);
        return;
      }

      const remaining = rateLimiter.check(chatIdStr);
      if (remaining !== null) {
        const rateLimitReply = await ctx.reply(`Vui lòng chờ ${remaining} giây trước khi dùng lệnh này lại.`);
        trackMessage(chatId, rateLimitReply.message_id);
        return;
      }

      rateLimiter.record(chatIdStr);
      try {
        const summary = await executeSummary(chatId, query);
        const parts = splitMessage(summary);
        for (const part of parts) {
          try {
            const partReply = await ctx.reply(part, { parse_mode: "Markdown" });
            trackMessage(chatId, partReply.message_id);
          } catch (mdErr) {
            console.warn("[Summary] Markdown parse failed, sending as plain text:", mdErr);
            const partReply = await ctx.reply(part);
            trackMessage(chatId, partReply.message_id);
          }
        }
      } catch (err) {
        console.error("[Summary] Error:", err);
        if (isQuotaError(err)) {
          const errReply = await ctx.reply("⚠️ Đã hết lượt gọi AI miễn phí trong ngày. Vui lòng thử lại sau vài phút hoặc ngày mai.");
          trackMessage(chatId, errReply.message_id);
        } else {
          const errReply = await ctx.reply("Không thể tóm tắt lúc này. Vui lòng thử lại sau.");
          trackMessage(chatId, errReply.message_id);
        }
      }
      return;
    }

    const userId = ctx.from?.id;
    const keyboard = new InlineKeyboard()
      .text("50 tin", `sum:50:${userId}`)
      .text("100 tin", `sum:100:${userId}`)
      .text("200 tin", `sum:200:${userId}`)
      .text("500 tin", `sum:500:${userId}`)
      .row()
      .text("6 giờ", `sum:6h:${userId}`)
      .text("12 giờ", `sum:12h:${userId}`)
      .text("1 ngày", `sum:1d:${userId}`)
      .text("3 ngày", `sum:3d:${userId}`);

    const sentMsg = await ctx.reply("Chọn phạm vi tóm tắt:", { reply_markup: keyboard });
    trackMessage(chatId, sentMsg.message_id);

    // Auto-delete keyboard after 30s if no one clicks
    const autoDeleteTimer = setTimeout(async () => {
      try {
        await ctx.api.deleteMessage(chatId, sentMsg.message_id);
      } catch {
        // Message already deleted or edited — ignore
      }
    }, 30_000);

    // Store timer so callback handler can cancel it
    pendingKeyboards.set(`${chatId}:${sentMsg.message_id}`, autoDeleteTimer);
  });

  bot.callbackQuery(/^sum:([^:]+):(\d+)$/, async (ctx) => {
    const arg = ctx.match[1];
    const ownerId = parseInt(ctx.match[2], 10);
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const chatIdStr = chatId.toString();

    if (ctx.from.id !== ownerId) {
      await ctx.answerCallbackQuery({
        text: "Chỉ người gõ lệnh mới có thể chọn.",
        show_alert: true,
      });
      return;
    }

    const query = parseQuery(arg);
    if (!query) {
      await ctx.answerCallbackQuery({ text: "Lựa chọn không hợp lệ." });
      return;
    }

    const remaining = rateLimiter.check(chatIdStr);
    if (remaining !== null) {
      await ctx.answerCallbackQuery({
        text: `Vui lòng chờ ${remaining} giây.`,
      });
      return;
    }

    await ctx.answerCallbackQuery();

    // Cancel auto-delete timer for this keyboard message
    const msgId = ctx.callbackQuery.message?.message_id;
    if (msgId) {
      const timerKey = `${chatId}:${msgId}`;
      const timer = pendingKeyboards.get(timerKey);
      if (timer) {
        clearTimeout(timer);
        pendingKeyboards.delete(timerKey);
      }
    }

    try {
      await ctx.editMessageText(`Đang tóm tắt (${query.label})...`);
    } catch (err) {
      console.warn("[Summary] Failed to edit progress message:", err);
    }

    rateLimiter.record(chatIdStr);
    try {
      const summary = await executeSummary(chatId, query);
      const parts = splitMessage(summary);
      // Edit original message with first part
      try {
        await ctx.editMessageText(parts[0], { parse_mode: "Markdown" });
      } catch (mdErr) {
        console.warn("[Summary] Markdown edit failed, retrying as plain text:", mdErr);
        try {
          await ctx.editMessageText(parts[0]);
        } catch (editErr) {
          console.warn("[Summary] Edit fallback failed, sending new message:", editErr);
          const sent = await ctx.api.sendMessage(chatIdStr, parts[0]);
          trackMessage(chatId, sent.message_id);
        }
      }
      // Send remaining parts as new messages
      for (let i = 1; i < parts.length; i++) {
        try {
          const sent = await ctx.api.sendMessage(chatIdStr, parts[i], { parse_mode: "Markdown" });
          trackMessage(chatId, sent.message_id);
        } catch (mdErr) {
          console.warn("[Summary] Markdown send failed for part, sending plain:", mdErr);
          const sent = await ctx.api.sendMessage(chatIdStr, parts[i]);
          trackMessage(chatId, sent.message_id);
        }
      }
    } catch (err) {
      console.error("[Summary] Error:", err);
      const errorMsg = isQuotaError(err)
        ? "⚠️ Đã hết lượt gọi AI miễn phí trong ngày. Vui lòng thử lại sau vài phút hoặc ngày mai."
        : "Không thể tóm tắt lúc này. Vui lòng thử lại sau.";
      try {
        await ctx.editMessageText(errorMsg);
      } catch (editErr) {
        console.warn("[Summary] Failed to edit error message, sending new:", editErr);
        const sent = await ctx.api.sendMessage(chatIdStr, errorMsg);
        trackMessage(chatId, sent.message_id);
      }
    }
  });
}
