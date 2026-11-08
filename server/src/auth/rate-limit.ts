export type RateLimiter = {
  check(ip: string): { blocked: false } | { blocked: true; retryAfterSeconds: number };
  recordFailure(ip: string): void;
  reset(ip: string): void;
};

export function createRateLimiter(
  opts: { max?: number; windowMs?: number; now?: () => number } = {},
): RateLimiter {
  const { max = 5, windowMs = 60_000, now = Date.now } = opts;
  const failures = new Map<string, number[]>();

  function recent(ip: string): number[] {
    const current = now();
    const kept = (failures.get(ip) ?? []).filter((at) => at + windowMs > current);
    if (kept.length === 0) failures.delete(ip);
    else failures.set(ip, kept);
    return kept;
  }

  return {
    check(ip) {
      const kept = recent(ip);
      if (kept.length < max) return { blocked: false };
      const retryAfterSeconds = Math.ceil((kept[0]! + windowMs - now()) / 1000);
      return { blocked: true, retryAfterSeconds };
    },
    recordFailure(ip) {
      const kept = recent(ip);
      kept.push(now());
      failures.set(ip, kept);
    },
    reset(ip) {
      failures.delete(ip);
    },
  };
}
