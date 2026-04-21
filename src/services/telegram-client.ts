import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { config } from "../config.js";

export const SESSION_FILE = "./data/session.txt";

const botUserId = parseInt(config.botToken.split(":")[0], 10);

let client: TelegramClient;

export function loadSession(): StringSession {
  // Try file first, then fall back to env var (useful for cloud deployments)
  if (existsSync(SESSION_FILE)) {
    const saved = readFileSync(SESSION_FILE, "utf-8").trim();
    if (saved.length > 0) {
      return new StringSession(saved);
    }
  }
  const envSession = process.env.TG_SESSION?.trim();
  if (envSession) {
    console.log("[MTProto] Loading session from TG_SESSION env var.");
    return new StringSession(envSession);
  }
  return new StringSession("");
}

function saveSession(): void {
  const sessionString = client.session.save() as unknown as string;
  writeFileSync(SESSION_FILE, sessionString, "utf-8");
  console.log("[MTProto] Session saved.");
}

export async function initTelegramClient(): Promise<void> {
  const session = loadSession();

  client = new TelegramClient(session, config.tgApiId, config.tgApiHash, {
    connectionRetries: 5,
  });

  if (session.getAuthKey() !== undefined) {
    // Existing session — just connect
    await client.connect();
    console.log("[MTProto] Connected with existing session.");
  } else {
    // First time — need interactive login
    const readline = await import("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const prompt = (question: string): Promise<string> =>
      new Promise((resolve) => rl.question(question, (ans) => { resolve(ans); }));

    try {
      await client.start({
        phoneNumber: async () => config.tgPhone || await prompt("Phone number: "),
        phoneCode: async () => await prompt("OTP code from Telegram: "),
        password: async () => await prompt("2FA password (if any): "),
        onError: (err) => console.error("[MTProto] Auth error:", err),
      });

      saveSession();
    } catch (err) {
      console.error("[MTProto] Login failed:", err);
      throw err;
    } finally {
      rl.close();
    }
  }
}

export interface FetchedMessage {
  senderName: string;
  username: string | null;
  text: string;
  timestamp: number;
}

function extractMessage(msg: Api.Message): FetchedMessage | null {
  // Skip bot's own messages to avoid re-summarizing previous summaries
  if (msg.sender instanceof Api.User && Number(msg.sender.id) === botUserId) {
    return null;
  }

  const text = msg.text || msg.message;
  if (!text) return null;

  const sender = msg.sender;
  let senderName = "Unknown";
  let username: string | null = null;

  if (sender instanceof Api.User) {
    senderName = [sender.firstName, sender.lastName].filter(Boolean).join(" ") || "Unknown";
    username = sender.username || null;
  } else if (sender instanceof Api.Channel) {
    senderName = sender.title || "Unknown";
    username = sender.username || null;
  }

  return { senderName, username, text, timestamp: msg.date ?? 0 };
}

function ensureClient(): TelegramClient {
  if (!client) {
    throw new Error("[MTProto] Client not initialized. Call initTelegramClient() first.");
  }
  return client;
}

export async function fetchMessages(chatId: number, limit: number): Promise<FetchedMessage[]> {
  const c = ensureClient();
  const result: FetchedMessage[] = [];
  let offsetId = 0;
  const batchSize = Math.min(limit * 2, 500);

  while (result.length < limit) {
    const messages = await c.getMessages(chatId, {
      limit: batchSize,
      ...(offsetId > 0 && { offsetId }),
    });

    if (messages.length === 0) break;

    for (const msg of messages) {
      const extracted = extractMessage(msg);
      if (extracted) result.push(extracted);
      if (result.length >= limit) break;
    }

    offsetId = messages[messages.length - 1].id;
    if (messages.length < batchSize) break;
  }

  return result.reverse();
}

export async function fetchMessagesSince(chatId: number, sinceTimestamp: number, maxCount: number): Promise<FetchedMessage[]> {
  const c = ensureClient();
  const result: FetchedMessage[] = [];
  let offsetId = 0;
  const batchSize = config.fetchBatchSize;

  while (result.length < maxCount) {
    const messages = await c.getMessages(chatId, {
      limit: batchSize,
      ...(offsetId > 0 && { offsetId }),
    });

    if (messages.length === 0) break;

    let reachedTimeLimit = false;
    for (const msg of messages) {
      const msgTimestamp = msg.date ?? 0;
      if (msgTimestamp < sinceTimestamp) {
        reachedTimeLimit = true;
        break;
      }

      const extracted = extractMessage(msg);
      if (extracted) result.push(extracted);
      if (result.length >= maxCount) break;
    }

    if (reachedTimeLimit) break;
    offsetId = messages[messages.length - 1].id;
    if (messages.length < batchSize) break;
  }

  return result.reverse();
}

export async function fetchBotRelatedMessageIds(chatId: number, maxScan = 500): Promise<number[]> {
  const c = ensureClient();
  const result: number[] = [];
  let offsetId = 0;
  const batchSize = 100;
  let scanned = 0;

  while (scanned < maxScan) {
    const messages = await c.getMessages(chatId, {
      limit: batchSize,
      ...(offsetId > 0 && { offsetId }),
    });

    if (messages.length === 0) break;

    for (const msg of messages) {
      // Bot's own messages
      if (msg.sender instanceof Api.User && Number(msg.sender.id) === botUserId) {
        result.push(msg.id);
        continue;
      }
      // User's /summary or /clear commands
      const text = msg.text || msg.message || "";
      if (text.startsWith("/summary") || text.startsWith("/clear")) {
        result.push(msg.id);
      }
    }

    scanned += messages.length;
    offsetId = messages[messages.length - 1].id;
    if (messages.length < batchSize) break;
  }

  return result;
}

export async function searchMessages(chatId: number, keyword: string, limit: number): Promise<FetchedMessage[]> {
  const c = ensureClient();
  const messages = await c.getMessages(chatId, {
    search: keyword,
    limit,
  });

  const result: FetchedMessage[] = [];
  for (const msg of messages) {
    const extracted = extractMessage(msg);
    if (extracted) result.push(extracted);
  }

  // getMessages with search returns newest first; reverse for chronological order
  return result.reverse();
}

export async function disconnectTelegramClient(): Promise<void> {
  if (client) {
    await client.disconnect();
  }
}
