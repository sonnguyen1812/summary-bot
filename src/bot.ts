import { Bot } from "grammy";
import { config } from "./config.js";

export const bot = new Bot(config.botToken);

bot.catch((err) => {
  console.error("[Bot] Unhandled error:", err.error);
});
