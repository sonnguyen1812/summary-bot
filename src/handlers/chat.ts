import type { Bot } from "grammy";
import { chatWithAI, postProcessResponse, type ChatMessage } from "../services/chat.js";
import { trackMessage } from "../services/message-tracker.js";
import { botUserId } from "../constants.js";
import { RateLimiter } from "../rate-limiter.js";
import type { FetchedMessage } from "../services/telegram-client.js";

export interface ChatTelegramClient {
  fetchMessages(chatId: number, limit: number): Promise<FetchedMessage[]>;
}

const rateLimiter = new RateLimiter(10);

// Conversation memory per chat
interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const chatMemory = new Map<number, StoredMessage[]>();
const MAX_MEMORY_PER_CHAT = 30;
const MAX_CHATS = 500;
const MEMORY_TTL_MS = 12 * 60 * 60 * 1000;

function getRecentContext(chatId: number): ChatMessage[] {
  const messages = chatMemory.get(chatId);
  if (!messages) return [];

  const now = Date.now();
  const fresh = messages.filter((m) => now - m.timestamp < MEMORY_TTL_MS);
  if (fresh.length === 0) {
    chatMemory.delete(chatId);
    return [];
  }
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

  // Evict oldest chats if too many are tracked
  if (chatMemory.size > MAX_CHATS) {
    const now = Date.now();
    for (const [id, msgs] of chatMemory) {
      if (msgs.length === 0 || now - msgs[msgs.length - 1].timestamp > MEMORY_TTL_MS) {
        chatMemory.delete(id);
      }
    }
  }
}

export function registerChatHandler(bot: Bot, telegramClient: ChatTelegramClient): void {
  // Fetch bot username once at startup — block first message until resolved
  let botUsername: string | null = null;
  const botInfoReady = bot.api.getMe().then((me) => {
    botUsername = me.username ?? null;
    console.log(`[Chat] Bot username: @${botUsername}`);
  }).catch((err) => {
    console.error("[Chat] Failed to fetch bot info:", err);
  });

  bot.on("message", async (ctx) => {
    // Wait for bot info on first message (typically resolves instantly)
    await botInfoReady;
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
    const rateLimitKey = `${chatId}:${userId}`;
    if (rateLimiter.check(rateLimitKey) !== null) {
      return;
    }
    rateLimiter.record(rateLimitKey);

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

      // Fetch recent group messages for context
      let groupContext: string | undefined;
      try {
        const recentMessages = await telegramClient.fetchMessages(chatId, 50);
        const lines = recentMessages
          .filter((m) => m.text.trim().length > 0)
          .map((m) => {
            const d = new Date(m.timestamp * 1000);
            const hh = String(d.getHours()).padStart(2, "0");
            const mm = String(d.getMinutes()).padStart(2, "0");
            return `[${hh}:${mm}] ${m.username || m.senderName}: ${m.text}`;
          });
        groupContext = lines.length > 0 ? lines.join("\n") : undefined;
      } catch (fetchErr) {
        console.warn("[Chat] Failed to fetch group context:", fetchErr);
        groupContext = undefined;
      }

      let aiResponse: string;
      try {
        const context = getRecentContext(chatId);
        aiResponse = await chatWithAI(cleanText, context, groupContext);
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
