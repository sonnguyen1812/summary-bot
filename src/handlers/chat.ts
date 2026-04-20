import type { Bot } from "grammy";
import { chatWithAI, postProcessResponse, type ChatMessage } from "../services/chat.js";
import { trackMessage } from "../services/message-tracker.js";
import { config } from "../config.js";

// Rate limiter: tracks last response time per (chatId, userId)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 10_000; // 10 seconds

function isRateLimited(chatId: number, userId: number): boolean {
  const key = `${chatId}:${userId}`;
  const last = rateLimitMap.get(key) ?? 0;
  return Date.now() - last < RATE_LIMIT_MS;
}

function markUsed(chatId: number, userId: number): void {
  const key = `${chatId}:${userId}`;
  rateLimitMap.set(key, Date.now());
}

// Derive bot user ID from bot token (first segment before the colon)
const botUserId = parseInt(config.botToken.split(":")[0], 10);

// Conversation memory per chat
interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const chatMemory = new Map<number, StoredMessage[]>();
const MAX_MEMORY_PER_CHAT = 8; // 4 exchanges
const MEMORY_TTL_MS = 60 * 60 * 1000; // 1 hour

function getRecentContext(chatId: number): ChatMessage[] {
  const messages = chatMemory.get(chatId);
  if (!messages) return [];

  const now = Date.now();
  const fresh = messages.filter((m) => now - m.timestamp < MEMORY_TTL_MS);
  if (fresh.length !== messages.length) {
    chatMemory.set(chatId, fresh);
  }

  return fresh.map(({ role, content }) => ({ role, content }));
}

function addToMemory(chatId: number, role: "user" | "assistant", content: string): void {
  if (!chatMemory.has(chatId)) {
    chatMemory.set(chatId, []);
  }
  const messages = chatMemory.get(chatId)!;
  messages.push({ role, content, timestamp: Date.now() });

  while (messages.length > MAX_MEMORY_PER_CHAT) {
    messages.shift();
  }
}

export function registerChatHandler(bot: Bot): void {
  // Fetch bot username once at startup
  let botUsername: string | null = null;
  bot.api.getMe().then((me) => {
    botUsername = me.username ?? null;
    console.log(`[Chat] Bot username: @${botUsername}`);
  }).catch((err) => {
    console.error("[Chat] Failed to fetch bot info:", err);
  });

  bot.on("message", async (ctx) => {
    // Only handle group/supergroup messages
    const chatType = ctx.chat.type;
    if (chatType === "private") return;

    const message = ctx.message;
    const text = message.text ?? message.caption ?? "";
    const userId = ctx.from?.id;
    const chatId = ctx.chat.id;

    if (!userId) return;

    // Check if message mentions the bot by @username
    const usernameLower = botUsername?.toLowerCase();
    const isMention = usernameLower
      ? text.toLowerCase().includes(`@${usernameLower}`)
      : false;

    // Check if message is a reply to the bot
    const isReplyToBot =
      message.reply_to_message?.from?.id === botUserId;

    if (!isMention && !isReplyToBot) return;

    // Skip if triggered by a bot command (commands have their own handlers)
    if (message.entities?.some((e) => e.type === "bot_command")) return;

    // Rate limit check
    if (isRateLimited(chatId, userId)) {
      return;
    }
    markUsed(chatId, userId);

    // Strip @botusername mention(s) from the text before sending to AI
    let cleanText = text;
    if (botUsername) {
      const mentionRegex = new RegExp(`@${botUsername}`, "gi");
      cleanText = cleanText.replace(mentionRegex, "").trim();
    }

    if (!cleanText) {
      const emptyReply = await ctx.reply("hmm?", {
        reply_parameters: { message_id: message.message_id },
      });
      trackMessage(chatId, emptyReply.message_id);
      return;
    }

    try {
      const reply = await ctx.reply("⏳", {
        reply_parameters: { message_id: message.message_id },
      });

      let aiResponse: string;
      try {
        const context = getRecentContext(chatId);
        aiResponse = await chatWithAI(cleanText, context);
      } catch (err) {
        console.error("[Chat] AI error:", err);
        await ctx.api.editMessageText(chatId, reply.message_id, "lỗi rồi, thử lại sau đi");
        trackMessage(chatId, reply.message_id);
        return;
      }

      const processed = postProcessResponse(aiResponse);
      addToMemory(chatId, "user", cleanText.length > 1000 ? cleanText.slice(0, 1000) : cleanText);
      addToMemory(chatId, "assistant", processed);

      await ctx.api.editMessageText(chatId, reply.message_id, processed);
      trackMessage(chatId, reply.message_id);
    } catch (err) {
      console.error("[Chat] Handler error:", err);
    }
  });
}
