const trackedMessages = new Map<number, number[]>();

const MAX_TRACKED = 200;

export function trackMessage(chatId: number, messageId: number): void {
  let list = trackedMessages.get(chatId);
  if (!list) {
    list = [];
    trackedMessages.set(chatId, list);
  }
  list.push(messageId);
  if (list.length > MAX_TRACKED) {
    trackedMessages.set(chatId, list.slice(-MAX_TRACKED));
  }
}

export function getTrackedMessages(chatId: number): number[] {
  return trackedMessages.get(chatId) ?? [];
}

export function clearTracked(chatId: number): void {
  trackedMessages.delete(chatId);
}
