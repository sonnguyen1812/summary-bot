const trackedMessages = new Map<number, number[]>();
const summaryCallers = new Map<number, Set<number>>();

const MAX_TRACKED = 200;

export function trackMessage(chatId: number, messageId: number): void {
  let list = trackedMessages.get(chatId);
  if (!list) {
    list = [];
    trackedMessages.set(chatId, list);
  }
  list.push(messageId);
  // Prevent memory leak
  if (list.length > MAX_TRACKED) {
    trackedMessages.set(chatId, list.slice(-MAX_TRACKED));
  }
}

export function trackSummaryCaller(chatId: number, userId: number): void {
  let callers = summaryCallers.get(chatId);
  if (!callers) {
    callers = new Set();
    summaryCallers.set(chatId, callers);
  }
  callers.add(userId);
}

export function isSummaryCaller(chatId: number, userId: number): boolean {
  return summaryCallers.get(chatId)?.has(userId) ?? false;
}

export function getTrackedMessages(chatId: number): number[] {
  return trackedMessages.get(chatId) ?? [];
}

export function clearTracked(chatId: number): void {
  trackedMessages.delete(chatId);
  summaryCallers.delete(chatId);
}
