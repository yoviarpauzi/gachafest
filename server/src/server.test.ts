import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { HOST, listen } from "./server";

describe("listen", () => {
  test("binds to loopback only, not every network interface", () => {
    const app = listen(new Elysia(), 0);
    try {
      expect(HOST).toBe("127.0.0.1");
      expect(app.server?.hostname).toBe("127.0.0.1");
    } finally {
      void app.stop();
    }
  });
});
