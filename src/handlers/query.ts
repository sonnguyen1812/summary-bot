import type { Bot } from "grammy";

interface QueryTelegramClient {
  searchMessages(chatId: number, keyword: string, limit: number): Promise<{ senderName: string; username: string | null; text: string; timestamp: number }[]>;
}

const QUERY_RATE_LIMIT_SECONDS = 10;
const QUERY_RESULT_LIMIT = 30;
const TELEGRAM_MSG_LIMIT = 4096;

const rateLimitMap = new Map<string, number>();

function isRateLimited(userId: string): number | null {
  const now = Date.now() / 1000;
  const lastTime = rateLimitMap.get(userId);
  if (lastTime !== undefined) {
    const elapsed = now - lastTime;
    if (elapsed < QUERY_RATE_LIMIT_SECONDS) {
      return Math.ceil(QUERY_RATE_LIMIT_SECONDS - elapsed);
    }
  }
  return null;
}

function recordRateLimit(userId: string): void {
  rateLimitMap.set(userId, Date.now() / 1000);
  if (rateLimitMap.size > 1000) {
    const now = Date.now() / 1000;
    for (const [key, timestamp] of rateLimitMap) {
      if (now - timestamp > QUERY_RATE_LIMIT_SECONDS) {
        rateLimitMap.delete(key);
      }
    }
  }
}

function formatQueryResult(msg: { senderName: string; username: string | null; text: string; timestamp: number }): string {
  const date = new Date(msg.timestamp * 1000);
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  const dd = date.getDate().toString().padStart(2, "0");
  const mo = (date.getMonth() + 1).toString().padStart(2, "0");
  const displayName = msg.username || msg.senderName || "Unknown";
  const snippet = msg.text.length > 200 ? msg.text.slice(0, 200) + "…" : msg.text;
  return `[${hh}:${mm} ${dd}/${mo}] ${displayName}: ${snippet}`;
}

export function registerQueryHandler(bot: Bot, telegramClient: QueryTelegramClient): void {
  bot.command("query", async (ctx) => {
    if (ctx.chat.type === "private") {
      await ctx.reply("Lệnh này chỉ hoạt động trong group.");
      return;
    }

    const keyword = ctx.match?.trim();
    if (!keyword || keyword.length === 0) {
      await ctx.reply("Sử dụng: /query <từ khóa>\nVí dụ: /query họp nhóm");
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

    try {
      const messages = await telegramClient.searchMessages(chatId, keyword, QUERY_RESULT_LIMIT);
      recordRateLimit(userId);

      if (messages.length === 0) {
        await ctx.reply(`Không tìm thấy tin nhắn nào chứa từ khóa "${keyword}".`);
        return;
      }

      const lines = messages.map(formatQueryResult);
      const isCapped = messages.length === QUERY_RESULT_LIMIT;
      const header = isCapped
        ? `🔍 Hiển thị ${QUERY_RESULT_LIMIT} kết quả gần nhất cho "${keyword}":\n\n`
        : `🔍 Tìm thấy ${messages.length} kết quả cho "${keyword}":\n\n`;

      const body = lines.join("\n");
      const fullText = header + body;

      if (fullText.length <= TELEGRAM_MSG_LIMIT) {
        await ctx.reply(fullText);
      } else {
        // Split at midpoint on newline boundary
        const mid = Math.floor(lines.length / 2);
        await ctx.reply(header + lines.slice(0, mid).join("\n"));
        await ctx.reply(lines.slice(mid).join("\n"));
      }
    } catch (err) {
      console.error("[Query] MTProto search error:", err);
      await ctx.reply("Không thể tìm kiếm lúc này. Vui lòng thử lại sau.");
    }
  });
}
