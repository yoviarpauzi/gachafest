import dotUrl from "../../assets/screen/live-dot.svg";

/** Figma `Live badge`, drawn at 1.25 times its component size on the big screen, in the top right corner. */
export function LiveBadge() {
  return (
    <div className="absolute top-14 right-20 origin-top-right scale-125">
      <div className="flex items-center gap-2 rounded-full border-[1.5px] border-black-700 px-4 py-2">
        <img src={dotUrl} alt="" aria-hidden="true" className="size-3.75 shrink-0" />
        <p className="font-sans text-[14px] leading-5 font-medium whitespace-nowrap text-ink">LIVE DRAW</p>
      </div>
    </div>
  );
}
