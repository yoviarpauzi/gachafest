import { describe, expect, test } from "bun:test";
import { createRateLimiter } from "./rate-limit";

function setup() {
  const t = { now: 0 };
  const limiter = createRateLimiter({ now: () => t.now });
  const fail = (ip: string, times: number) => {
    for (let i = 0; i < times; i++) limiter.recordFailure(ip);
  };
  return { t, limiter, fail };
}

describe("createRateLimiter", () => {
  test("not blocked after 4 failures", () => {
    const { limiter, fail } = setup();
    fail("1.1.1.1", 4);
    expect(limiter.check("1.1.1.1")).toEqual({ blocked: false });
  });

  test("blocked after 5 failures", () => {
    const { limiter, fail } = setup();
    fail("1.1.1.1", 5);
    expect(limiter.check("1.1.1.1").blocked).toBe(true);
  });

  test("retryAfterSeconds is 50 when oldest failure was at t=0 and now is 10_000", () => {
    const { t, limiter, fail } = setup();
    fail("1.1.1.1", 5);
    t.now = 10_000;
    expect(limiter.check("1.1.1.1")).toEqual({ blocked: true, retryAfterSeconds: 50 });
  });

  test("unblocked once the oldest failure leaves the window", () => {
    const { t, limiter, fail } = setup();
    fail("1.1.1.1", 5);
    t.now = 60_001;
    expect(limiter.check("1.1.1.1")).toEqual({ blocked: false });
  });

  test("reset clears an ip", () => {
    const { limiter, fail } = setup();
    fail("1.1.1.1", 5);
    limiter.reset("1.1.1.1");
    expect(limiter.check("1.1.1.1")).toEqual({ blocked: false });
  });

  test("ips are independent", () => {
    const { limiter, fail } = setup();
    fail("1.1.1.1", 5);
    expect(limiter.check("2.2.2.2")).toEqual({ blocked: false });
  });
});
