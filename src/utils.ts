import { TELEGRAM_MSG_LIMIT } from "./constants.js";

export function splitMessage(text: string, limit: number = TELEGRAM_MSG_LIMIT): string[] {
  if (text.length <= limit) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      parts.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf("\n", limit);
    if (splitAt <= 0) {
      splitAt = remaining.lastIndexOf(" ", limit);
      if (splitAt <= 0) splitAt = limit;
    }
    parts.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  return parts;
}

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`[Timeout] ${label} exceeded ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

export const MTPROTO_TIMEOUT_MS = 25_000;
