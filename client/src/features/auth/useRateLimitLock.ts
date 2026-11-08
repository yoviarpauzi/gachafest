import { useEffect, useState } from "react";
import type { ApiError } from "../../lib/api";

const DEFAULT_LOCK_SECONDS = 60;

function lockSeconds(error: ApiError | null): number | null {
  if (!error || error.status !== 429) return null;
  const seconds = (error.body as { retryAfterSeconds?: unknown } | undefined)?.retryAfterSeconds;
  return typeof seconds === "number" && seconds > 0 ? seconds : DEFAULT_LOCK_SECONDS;
}

/** True while a 429 error's retryAfterSeconds is counting down, false again afterwards. */
export function useRateLimitLock(error: ApiError | null): boolean {
  const [expired, setExpired] = useState<ApiError | null>(null);
  const seconds = lockSeconds(error);

  useEffect(() => {
    if (seconds === null) return;
    const id = setTimeout(() => setExpired(error), seconds * 1000);
    return () => clearTimeout(id);
  }, [error, seconds]);

  return seconds !== null && expired !== error;
}
