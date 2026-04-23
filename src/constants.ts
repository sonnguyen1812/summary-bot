import { config } from "./config.js";

export const TELEGRAM_MSG_LIMIT = 4096;

export const botUserId = parseInt(config.botToken.split(":")[0], 10);
