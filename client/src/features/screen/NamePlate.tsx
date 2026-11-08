import { nameFontSize } from "./nameSize";

const NAME_WIDTH = 820;
const MAX_SIZE = 112;

/**
 * Figma `Name plate`: the machine turned into a gold plate with the winner's name, 1000 px wide with its
 * base. The frame is always there (hidden until the timeline brings it in); `name` is only passed from the
 * moment the plate is shown, so the winner is not in the page before then.
 */
export function NamePlate({ name, className = "" }: { name: string | null; className?: string }) {
  const { fontSize, lines } = name === null ? { fontSize: MAX_SIZE, lines: 1 as const } : nameFontSize(name, NAME_WIDTH);

  return (
    <div data-fx="plate" className={`flex w-250 flex-col items-center ${className}`}>
      <div className="relative rounded-xl bg-gold-vertical p-4 shadow-[0px_12px_18px_0px_rgba(0,0,0,0.5),0px_0px_90px_0px_rgba(219,171,97,0.55),inset_0px_-4px_4px_0px_rgba(58,36,8,0.6),inset_0px_3px_2px_0px_rgba(255,244,214,0.9)]">
        <div className="relative rounded-lg border-[1.5px] border-gold-dim bg-machine-bezel p-4 shadow-[inset_0px_6px_10px_0px_rgba(0,0,0,0.8)]">
          <div className="relative flex h-60 w-220 flex-col items-center justify-center gap-4.5 overflow-hidden rounded-md border-2 border-[rgba(185,138,69,0.7)] bg-cream-reel">
            {lines === 1 && <div aria-hidden="true" className="h-[3px] w-130 shrink-0 bg-gold-rule" />}
            <p
              className="relative max-w-205 text-center font-display font-extrabold tracking-[-1.12px] text-balance text-black-950"
              style={{
                fontSize: Math.min(MAX_SIZE, fontSize),
                lineHeight: lines === 1 ? "1.143" : "1.05",
                textShadow: "0px 3px 4px rgba(192, 151, 89, 0.35)",
                whiteSpace: lines === 1 ? "nowrap" : "normal",
              }}
            >
              {name}
            </p>
            {lines === 1 && <div aria-hidden="true" className="h-[3px] w-130 shrink-0 bg-gold-rule" />}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_0px_12px_0px_rgba(122,95,48,0.35)]" />
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="flex flex-col items-center">
        <div className="h-12.5 w-200 rounded-md border border-gold-dim bg-machine-base" />
        <div className="h-3 w-250 rounded-full bg-gold-vertical" />
      </div>
    </div>
  );
}
