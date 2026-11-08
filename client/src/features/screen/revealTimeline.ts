import gsap from "gsap";
import { emphasis } from "./reel";
import { scheduleFor, type Tier } from "./timing";

const STRIP = '[data-fx="reel-strip"]';

/**
 * Gives the names near the middle of the window their look (size and fade by distance from the middle) and
 * the whole strip its motion blur. Only names within two lines of the middle are touched.
 */
export function paintStrip(strip: HTMLElement, blur: number): void {
  const pitch = Number(strip.dataset.pitch);
  const offset = -Number(gsap.getProperty(strip, "y")) / pitch;
  strip.style.setProperty("--blur", String(blur));
  const items = strip.querySelectorAll<HTMLElement>("[data-reel-item]");
  const from = Math.max(0, Math.floor(offset) - 2);
  const to = Math.min(items.length - 1, Math.ceil(offset) + 2);
  for (let i = from; i <= to; i++) {
    const { scale, t } = emphasis(i - offset);
    items[i]!.style.transform = `scale(${scale})`;
    items[i]!.style.setProperty("--t", String(t));
  }
}

/** Repaints the strip at rest, after the timeline was moved by hand. */
export function refreshStrip(scope: HTMLElement): void {
  const strip = scope.querySelector<HTMLElement>(STRIP);
  if (strip) paintStrip(strip, 0);
}

/**
 * One paused GSAP timeline for a whole reveal, as long as the server's animation for the tier. The reel
 * spins for `reelEnd` and slows to a stop with the winner in the middle of the window; later stages are added
 * to the same timeline.
 */
export function buildRevealTimeline(scope: HTMLElement, options: { tier: Tier }): gsap.core.Timeline {
  const schedule = scheduleFor(options.tier);
  const tl = gsap.timeline({ paused: true });
  // Makes the timeline last exactly as long as the animation, whatever the tweens inside add up to.
  tl.set({}, {}, schedule.total / 1000);

  const strip = scope.querySelector<HTMLElement>(STRIP);
  if (strip) {
    const travel = (Number(strip.dataset.count) - 1) * Number(strip.dataset.pitch);
    // Every name starts in its small look; `paintStrip` gives the ones near the middle theirs as it moves.
    for (const item of strip.querySelectorAll<HTMLElement>("[data-reel-item]")) item.style.setProperty("--t", "1");
    let lastY = 0;
    tl.fromTo(
      strip,
      { y: 0 },
      {
        y: -travel,
        duration: schedule.reelEnd / 1000,
        ease: "power3.out",
        onUpdate: () => {
          const y = Number(gsap.getProperty(strip, "y"));
          // Blur follows the speed, and is gone once the reel has stopped (or when it has nowhere to go).
          paintStrip(strip, Math.abs(y) >= travel - 1 ? 0 : Math.min(2, Math.abs(y - lastY) / 70));
          lastY = y;
        },
      },
      0,
    );
    paintStrip(strip, 0);
  }

  return tl;
}
