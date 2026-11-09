import brandUrl from "../../assets/screen/brand.webp";
import { EVENT } from "./event";

// Figma `Event lockup` on the big screen: the compact one (512 px wide) sits in the corner, the large one
// (614 px wide, 1.5 times the compact sizes) on the title screen. The brand asset is a square with the
// logo centred, so a 4:1 frame plus object-cover crops the empty space around it.
const SIZES = {
  compact: {
    row: "gap-4",
    brand: "h-11 w-44",
    tagline: "text-[14px] leading-[20px]",
  },
  large: {
    row: "gap-6",
    brand: "h-16.5 w-66",
    tagline: "text-[21px] leading-[30px]",
  },
} as const;

export function EventLockup({ size, className = "" }: { size: "large" | "compact"; className?: string }) {
  const s = SIZES[size];
  return (
    <div className={`flex items-center whitespace-nowrap ${s.row} ${className}`}>
      <img src={brandUrl} alt={EVENT.name} className={`shrink-0 object-cover ${s.brand}`} />
    </div>
  );
}
