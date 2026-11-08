import gsap from "gsap";
import { emphasis } from "./reel";
import { scheduleFor, type Schedule, type Tier } from "./timing";

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

const seconds = (ms: number) => ms / 1000;

/** The reel spins for `reelEnd`, slows down and stops with the winner in the middle of the window. */
function addReel(tl: gsap.core.Timeline, scope: HTMLElement, schedule: Schedule, reducedMotion: boolean): void {
  const strip = scope.querySelector<HTMLElement>(STRIP);
  if (!strip) return;
  const travel = (Number(strip.dataset.count) - 1) * Number(strip.dataset.pitch);
  // Every name starts in its small look; `paintStrip` gives the ones near the middle theirs as it moves.
  for (const item of strip.querySelectorAll<HTMLElement>("[data-reel-item]")) item.style.setProperty("--t", "1");

  if (reducedMotion) {
    // No spin, and the winner must not sit in the window for the whole reveal: the strip is hidden and the
    // window just says the draw is under way, until the plate fades in at the end.
    gsap.set(strip, { autoAlpha: 0 });
    const hold = scope.querySelector<HTMLElement>('[data-fx="reel-hold"]');
    if (hold) gsap.set(hold, { autoAlpha: 1 });
    return;
  }

  let lastY = 0;
  tl.fromTo(
    strip,
    { y: 0 },
    {
      y: -travel,
      duration: seconds(schedule.reelEnd),
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

/**
 * The wish-style sequence between the reel and the plate. The screen dims, a star falls from the top left onto
 * the machine, the impact flashes (premium: a white-gold burst over the whole screen and a small shake), and
 * the flash fades. Basic is smaller, silver-cream and shorter, with no burst and no shake.
 */
function addEffects(tl: gsap.core.Timeline, scope: HTMLElement, tier: Tier, schedule: Schedule): void {
  const premium = tier === "premium";
  const pick = (name: string) => scope.querySelector<HTMLElement>(`[data-fx="${name}"]`);
  const dim = pick("dim");
  const star = pick("star");
  const flash = pick("flash");
  const burst = pick("burst");
  const art = pick("stage-art");

  const dimAt = seconds(schedule.reelEnd);
  if (dim) {
    tl.fromTo(dim, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: "power1.out" }, dimAt);
    // The dim goes away with the plate coming in, so the winner is shown on the plain screen as in Figma.
    tl.to(dim, { autoAlpha: 0, duration: Math.min(1, seconds(schedule.total - schedule.flashEnd)), ease: "power1.in" }, seconds(schedule.flashEnd));
  }

  if (star) {
    const travel = Number(star.dataset.travel);
    const fall = seconds(schedule.starEnd - schedule.reelEnd);
    tl.fromTo(star, { x: -travel, y: -travel }, { x: 0, y: 0, duration: fall, ease: "power2.in" }, dimAt);
    tl.fromTo(star, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12 }, dimAt);
    tl.to(star, { autoAlpha: 0, duration: 0.1 }, seconds(schedule.starEnd));
  }

  const impact = seconds(schedule.starEnd);
  if (flash) {
    const flashLength = seconds(schedule.flashEnd - schedule.starEnd);
    const grow = premium ? 0.25 : 0.15;
    const hold = premium ? 0.2 : 0.1;
    tl.fromTo(flash, { scale: premium ? 0.1 : 0.3, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: grow, ease: "power3.out" }, impact);
    if (premium) tl.fromTo(flash, { rotation: 0 }, { rotation: 14, duration: flashLength, ease: "none" }, impact);
    tl.to(flash, { autoAlpha: 0, scale: 1.15, duration: flashLength - grow - hold, ease: "power2.in" }, impact + grow + hold);
  }
  if (burst) {
    tl.fromTo(burst, { autoAlpha: 0 }, { autoAlpha: 0.9, duration: 0.08, ease: "power2.out" }, impact);
    tl.to(burst, { autoAlpha: 0, duration: 0.7, ease: "power2.in" }, impact + 0.08);
  }
  if (premium && art) {
    tl.to(art, { x: 6, y: -4, duration: 0.04, yoyo: true, repeat: 7, ease: "none" }, impact);
    tl.set(art, { x: 0, y: 0 }, impact + 0.34);
  }
}

/** Confetti, premium only, falling from the end of the flash. Pieces that outlast the animation just keep falling. */
function addConfetti(tl: gsap.core.Timeline, scope: HTMLElement, schedule: Schedule): void {
  const start = seconds(schedule.flashEnd) - 0.1;
  for (const piece of scope.querySelectorAll<HTMLElement>('[data-fx="confetti"] [data-piece]')) {
    const { delay, duration, drift, rotation } = piece.dataset;
    tl.fromTo(
      piece,
      { y: -60, x: 0, rotation: 0, autoAlpha: 1 },
      { y: 1140, x: Number(drift), rotation: Number(rotation), duration: Number(duration), ease: "none" },
      start + Number(delay),
    );
  }
}

/** The prize heading, its value and the plate come in while the machine and ribbon go. */
function addPlate(tl: gsap.core.Timeline, scope: HTMLElement, at: number, fadeIn: number): void {
  const pick = (selector: string) => scope.querySelector(selector);
  const art = pick('[data-fx="stage-art"]');
  if (art) tl.to(art, { autoAlpha: 0, duration: fadeIn / 2, ease: "power1.in" }, at);
  for (const selector of ['[data-fx="heading"]', '[data-fx="amount"]']) {
    const el = pick(selector);
    if (el) tl.to(el, { autoAlpha: 1, duration: fadeIn, ease: "power2.out" }, at);
  }
  const plate = pick('[data-fx="plate"]');
  if (plate) tl.fromTo(plate, { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: fadeIn, ease: "power2.out" }, at);
}

/**
 * One paused GSAP timeline for a whole reveal, at least as long as the server's animation for the tier (premium
 * confetti may fall a little longer). With reduced motion there is no spin, star, flash or confetti: the plate
 * fades in over the last second and ends exactly when the animation ends.
 */
export function buildRevealTimeline(scope: HTMLElement, options: { tier: Tier; reducedMotion: boolean }): gsap.core.Timeline {
  const schedule = scheduleFor(options.tier);
  const tl = gsap.timeline({ paused: true });
  // Makes the timeline last at least as long as the animation, whatever the tweens inside add up to.
  tl.set({}, {}, seconds(schedule.total));

  addReel(tl, scope, schedule, options.reducedMotion);
  if (options.reducedMotion) {
    // The last second: the screen dims a little and the plate fades in, ending exactly when the animation ends.
    const at = seconds(schedule.total) - 1;
    const dim = scope.querySelector<HTMLElement>('[data-fx="dim"]');
    if (dim) {
      tl.fromTo(dim, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: "power1.out" }, at);
      tl.to(dim, { autoAlpha: 0, duration: 0.65, ease: "power1.in" }, at + 0.35);
    }
    addPlate(tl, scope, at, 1);
    return tl;
  }

  addEffects(tl, scope, options.tier, schedule);
  addPlate(tl, scope, seconds(schedule.flashEnd), Math.min(1, seconds(schedule.total - schedule.flashEnd)));
  if (options.tier === "premium") addConfetti(tl, scope, schedule);
  return tl;
}
