import Anthropic from "@anthropic-ai/sdk";

export function isRetryableError(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    // Don't retry auth, permission, or bad request errors
    if (err.status === 400 || err.status === 401 || err.status === 403) return false;
    // Retry rate limits, server errors, timeouts
    return true;
  }
  if (err instanceof Error && err.name === "AbortError") return false;
  return true;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  validate?: (result: T) => boolean,
  maxAttempts = 3,
): Promise<T> {
  const delays = [0, 3000, 6000];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (delays[attempt] > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
    try {
      const result = await fn();
      if (validate && !validate(result)) {
        if (attempt === maxAttempts - 1) {
          throw new Error("Response failed validation after all retries");
        }
        console.warn(`[Retry] Validation failed on attempt ${attempt + 1}, retrying...`);
        continue;
      }
      return result;
    } catch (err) {
      if (!isRetryableError(err) || attempt === maxAttempts - 1) throw err;
      console.error(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delays[attempt + 1]}ms:`, err);
    }
  }
  throw new Error("Unreachable");
}
