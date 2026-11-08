import { describe, expect, test } from "bun:test";
import { createScreenPresence } from "./presence";

describe("screen presence", () => {
  test("is closed before the screen has ever been seen", () => {
    const clock = { at: 1_000_000 };
    expect(createScreenPresence(() => clock.at).isOpen()).toBe(false);
  });

  test("is open for 15 seconds after the screen was seen, then closes", () => {
    const clock = { at: 1_000_000 };
    const presence = createScreenPresence(() => clock.at);
    presence.seen();
    expect(presence.isOpen()).toBe(true);
    clock.at += 15_000;
    expect(presence.isOpen()).toBe(true);
    clock.at += 1;
    expect(presence.isOpen()).toBe(false);
  });

  test("opens again when the screen is seen again", () => {
    const clock = { at: 1_000_000 };
    const presence = createScreenPresence(() => clock.at);
    presence.seen();
    clock.at += 60_000;
    expect(presence.isOpen()).toBe(false);
    presence.seen();
    expect(presence.isOpen()).toBe(true);
  });
});
