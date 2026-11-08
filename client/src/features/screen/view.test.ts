import { describe, expect, test } from "bun:test";
import type { ScreenState } from "./api";
import { deriveView } from "./view";

const prize = (tier: "basic" | "premium"): NonNullable<ScreenState["prize"]> => ({
  name: "Grand Prize",
  value: 10_000_000,
  tier,
  position: 1,
  total: 4,
});

const latest: ScreenState["latest"] = [{ winnerName: "Rina Pratama", prizeName: "Grand Prize", prizeValue: 10_000_000 }];

const reveal = (skipped = false): NonNullable<ScreenState["reveal"]> => ({
  winnerName: "Budi Santoso",
  reel: ["Ana", "Citra"],
  revealedAt: "2026-11-09T10:00:00.000Z",
  animationEndsAt: "2026-11-09T10:00:08.000Z",
  skipped,
});

const state = (patch: Partial<ScreenState>): ScreenState => ({
  now: "2026-11-09T10:00:00.000Z",
  phase: "idle",
  prize: null,
  reveal: null,
  latest: [],
  ...patch,
});

describe("deriveView", () => {
  test("without an answer yet the screen is empty", () => {
    expect(deriveView(undefined, 0)).toEqual({ kind: "empty" });
  });

  test("idle phase shows the title screen", () => {
    expect(deriveView(state({ phase: "idle" }), 0)).toEqual({ kind: "idle" });
  });

  test("standby carries the active prize and the latest winners", () => {
    const view = deriveView(state({ phase: "standby", prize: prize("basic"), latest }), 0);
    expect(view).toEqual({ kind: "standby", prize: prize("basic"), latest });
  });

  test("standby with every prize drawn has no prize", () => {
    const view = deriveView(state({ phase: "standby", prize: null, latest }), 0);
    expect(view).toEqual({ kind: "standby", prize: null, latest });
  });

  test.each([
    [0, "reel"],
    [3000, "reel"],
    [4000, "flash"],
    [6000, "plate"],
    [8000, "done"],
  ] as const)("a premium reveal at %d ms is in stage %s", (elapsed, stage) => {
    const view = deriveView(state({ phase: "reveal", prize: prize("premium"), reveal: reveal() }), elapsed);
    expect(view).toMatchObject({ kind: "reveal", tier: "premium", stage });
  });

  test.each([
    [1000, "reel"],
    [2000, "flash"],
    [3000, "plate"],
    [3500, "plate"],
    [4000, "done"],
  ] as const)("a basic reveal at %d ms is in stage %s", (elapsed, stage) => {
    const view = deriveView(state({ phase: "reveal", prize: prize("basic"), reveal: reveal() }), elapsed);
    expect(view).toMatchObject({ kind: "reveal", tier: "basic", stage });
  });

  test("a skipped reveal is done at once", () => {
    const view = deriveView(state({ phase: "reveal", prize: prize("premium"), reveal: reveal(true) }), 0);
    expect(view).toMatchObject({ kind: "reveal", stage: "done", skipped: true });
  });

  test("a reveal carries the winner, the reel and a key that is its revealedAt", () => {
    const view = deriveView(state({ phase: "reveal", prize: prize("premium"), reveal: reveal() }), 0);
    expect(view).toMatchObject({
      key: "2026-11-09T10:00:00.000Z",
      winnerName: "Budi Santoso",
      reel: ["Ana", "Citra"],
      prize: prize("premium"),
    });
  });

  test("a reveal without a prize does not throw and uses the basic schedule", () => {
    const view = deriveView(state({ phase: "reveal", prize: null, reveal: reveal() }), 2200);
    expect(view).toMatchObject({ kind: "reveal", tier: "basic", stage: "flash", prize: null });
  });

  test("the reveal phase without reveal data falls back to standby instead of crashing", () => {
    expect(deriveView(state({ phase: "reveal", prize: prize("basic"), reveal: null }), 0)).toMatchObject({
      kind: "standby",
    });
  });
});
