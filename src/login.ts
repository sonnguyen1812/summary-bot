import { TelegramClient } from "telegram";
import { writeFileSync, mkdirSync } from "fs";
import { config as loadEnv } from "dotenv";
import * as readline from "readline";
import { loadSession, SESSION_FILE } from "./services/telegram-client.js";

loadEnv();

const API_ID = parseInt(process.env.TG_API_ID || "0", 10);
const API_HASH = process.env.TG_API_HASH || "";
const PHONE = process.env.TG_PHONE || "";

mkdirSync("./data", { recursive: true });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const prompt = (q: string): Promise<string> =>
  new Promise((resolve) => rl.question(q, (ans) => resolve(ans)));

async function main() {
  const session = loadSession();
  const client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
  });

  console.log("Logging in...");

  try {
    await client.start({
      phoneNumber: async () => PHONE || await prompt("Phone number: "),
      phoneCode: async () => await prompt("OTP code from Telegram: "),
      password: async () => await prompt("2FA password (if any): "),
      onError: (err) => console.error("Auth error:", err),
    });

    const sessionString = client.session.save() as unknown as string;
    writeFileSync(SESSION_FILE, sessionString, "utf-8");
    console.log("Session saved to", SESSION_FILE);
    console.log("You can now run 'yarn dev' — no OTP needed next time.");

    await client.disconnect();
  } catch (err) {
    console.error("Login failed:", err);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
