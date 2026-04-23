export class RateLimiter {
  private map = new Map<string, number>();
  private readonly seconds: number;
  private readonly maxEntries: number;

  constructor(seconds: number, maxEntries = 1000) {
    this.seconds = seconds;
    this.maxEntries = maxEntries;
  }

  check(key: string): number | null {
    const now = Date.now() / 1000;
    const lastTime = this.map.get(key);
    if (lastTime !== undefined) {
      const elapsed = now - lastTime;
      if (elapsed < this.seconds) {
        return Math.ceil(this.seconds - elapsed);
      }
    }
    return null;
  }

  record(key: string): void {
    this.map.set(key, Date.now() / 1000);
    this.cleanup();
  }

  unrecord(key: string): void {
    this.map.delete(key);
  }

  private cleanup(): void {
    if (this.map.size <= this.maxEntries) return;
    const now = Date.now() / 1000;
    for (const [key, timestamp] of this.map) {
      if (now - timestamp > this.seconds) {
        this.map.delete(key);
      }
    }
  }
}
