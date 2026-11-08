import { EventLockup } from "./EventLockup";

/** Figma `Big screen / Idle`: the title screen before the first draw. */
export function IdleView() {
  return (
    <>
      <EventLockup size="large" className="absolute top-27.5 left-1/2 -translate-x-1/2" />
      <h1 className="absolute top-62.5 left-0 w-480 text-center font-display text-[140px] leading-40 font-extrabold tracking-[-2.8px] text-black-950 [-webkit-text-stroke:4px_var(--color-gold-500)] [paint-order:stroke_fill]">
        A Story of
      </h1>
      <p className="text-gold-metal absolute top-102.5 left-0 w-480 text-center font-display text-[340px] leading-90 font-extrabold tracking-[-10.2px]">
        Growth
      </p>
      <p className="absolute top-212.5 left-0 w-480 text-center font-display text-[36px] leading-6 font-semibold tracking-[7.92px] text-gold-300 uppercase">
        Celebrating our 30th anniversary
      </p>
    </>
  );
}
