import { EVENT } from "./event";

// Figma `Event lockup` on the big screen: the compact one (512 px wide) sits in the corner, the large one
// (614 px wide, 1.5 times the compact sizes) on the title screen.
const SIZES = {
  compact: {
    row: "gap-4",
    number: "text-[40px] leading-[44px]",
    name: "text-[20px] leading-[28px]",
    tagline: "text-[14px] leading-[20px]",
  },
  large: {
    row: "gap-6",
    number: "text-[60px] leading-[66px]",
    name: "text-[30px] leading-[42px]",
    tagline: "text-[21px] leading-[30px]",
  },
} as const;

export function EventLockup({ size, className = "" }: { size: "large" | "compact"; className?: string }) {
  const s = SIZES[size];
  return (
    <div className={`flex items-center whitespace-nowrap ${s.row} ${className}`}>
      <p className={`text-gold-metal font-display font-extrabold ${s.number}`}>30</p>
      <div aria-hidden="true" className="h-13.5 w-[1.5px] bg-gold-dim" />
      <p className={`font-display font-semibold text-ink ${s.name}`}>{EVENT.name}</p>
      <div aria-hidden="true" className="h-13.5 w-[1.5px] bg-gold-dim" />
      <p className={`font-sans text-gold-muted ${s.tagline}`}>{EVENT.tagline}</p>
    </div>
  );
}
