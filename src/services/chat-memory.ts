import type { ChatMessage } from "./chat.js";

interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const chatMemory = new Map<number, StoredMessage[]>();
const MAX_MEMORY_PER_CHAT = 30;
const MAX_CHATS = 500;
const MEMORY_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_MEMORY_CONTENT = 2000;

export function getRecentContext(chatId: number): ChatMessage[] {
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

export function addToMemory(chatId: number, role: "user" | "assistant", content: string): void {
  const truncated = content.length > MAX_MEMORY_CONTENT
    ? content.slice(0, MAX_MEMORY_CONTENT) + "…"
    : content;

  if (!chatMemory.has(chatId)) {
    chatMemory.set(chatId, []);
  }
  const messages = chatMemory.get(chatId)!;
  messages.push({ role, content: truncated, timestamp: Date.now() });

  while (messages.length > MAX_MEMORY_PER_CHAT) {
    messages.shift();
  }

  if (chatMemory.size > MAX_CHATS) {
    const now = Date.now();
    for (const [id, msgs] of chatMemory) {
      if (msgs.length === 0 || now - msgs[msgs.length - 1].timestamp > MEMORY_TTL_MS) {
        chatMemory.delete(id);
      }
    }
  }
}
