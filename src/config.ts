import { config as loadEnv } from "dotenv";

loadEnv();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. Please set it in your .env file.`
    );
  }
  return value;
}

function requireEnvInt(name: string): number {
  const raw = requireEnv(name);
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new Error(`${name} must be a valid integer, got: "${raw}"`);
  }
  return parsed;
}

function optionalEnvNumber(name: string, defaultValue: number, min = 1): number {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed < min) {
    console.warn(`[Config] Invalid ${name}="${raw}" (must be integer >= ${min}), using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

export const config = {
  botToken: requireEnv("BOT_TOKEN"),
  aiApiKey: requireEnv("AI_API_KEY"),
  aiBaseUrl: process.env.AI_BASE_URL?.trim() || undefined,
  aiModel: process.env.AI_MODEL?.trim() || "claude-haiku-4-5",
  tgApiId: requireEnvInt("TG_API_ID"),
  tgApiHash: requireEnv("TG_API_HASH"),
  tgPhone: process.env.TG_PHONE?.trim() || undefined,
  defaultMessageCount: optionalEnvNumber("DEFAULT_MESSAGE_COUNT", 50),
  maxMessageCount: optionalEnvNumber("MAX_MESSAGE_COUNT", 500),
  rateLimitSeconds: optionalEnvNumber("RATE_LIMIT_SECONDS", 30),
  fetchBatchSize: optionalEnvNumber("FETCH_BATCH_SIZE", 200),
} as const;
