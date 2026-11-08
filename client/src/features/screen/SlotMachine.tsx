import type { ReactNode } from "react";
import leverUrl from "../../assets/screen/lever.svg";
import { nameFontSize } from "./nameSize";
import { Scaled } from "./Scaled";

const WIDTH = 884;
const HEIGHT = 428.4;
/** Inner width of the reel window in Figma px; text longer than this shrinks to fit. */
export const WINDOW_WIDTH = 640;
/** Height of one line in the window; a strip of names moves in steps of this. */
export const WINDOW_HEIGHT = 272;

/** Text in the reel window at the Figma size (85 px), smaller only when it would not fit. */
export function MachineText({ children }: { children: string }) {
  const { fontSize } = nameFontSize(children, WINDOW_WIDTH);
  return (
    <p
      className="relative text-center font-display leading-[1.24] font-extrabold tracking-[-0.85px] whitespace-nowrap text-black-950"
      style={{ fontSize: Math.min(85, fontSize) }}
    >
      {children}
    </p>
  );
}

/**
 * Figma `Slot Machine XL`, drawn at its 884 px size and scaled. `children` fill the reel window: text for the
 * idle machine, the strip of names for the spinning one.
 */
export function SlotMachine({ scale = 1, className = "", children }: { scale?: number; className?: string; children: ReactNode }) {
  return (
    <Scaled width={WIDTH} height={HEIGHT} scale={scale} className={className}>
      <div className="relative flex size-full flex-col items-center">
        <div className="relative flex items-end pr-27.2">
          <div aria-hidden="true" className="absolute top-[-85px] left-[734.4px] h-[433.5px] w-55.25">
            <img src={leverUrl} alt="" className="absolute block size-full max-w-none inset-[0_-0.77%_-6.67%_-7.69%]" />
          </div>

          <div className="relative rounded-[40.8px] bg-gold-vertical p-[20.4px] shadow-[0px_17px_27.2px_0px_rgba(0,0,0,0.5),0px_0px_81.6px_0px_rgba(219,171,97,0.35),inset_0px_-5.1px_5.1px_0px_rgba(90,58,16,0.7),inset_0px_3.4px_3.4px_0px_rgba(255,244,214,0.9)]">
            <div className="relative rounded-[27.2px] border-[1.7px] border-gold-600 bg-machine-bezel p-[20.4px] shadow-[inset_0px_6.8px_13.6px_0px_rgba(0,0,0,0.8)]">
              <div className="relative flex h-68 w-[690.2px] items-center justify-center overflow-hidden rounded-[20.4px] border-[2.55px] border-[rgba(185,138,69,0.7)] bg-cream-reel">
                {children}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_0px_17px_0px_rgba(122,95,48,0.35)]" />
              </div>
            </div>
          </div>
        </div>

        <div aria-hidden="true" className="flex flex-col items-center">
          <div className="h-[57.8px] w-170 rounded-[20.4px] border-[1.7px] border-gold-dim bg-machine-base" />
          <div className="h-[13.6px] w-204 rounded-full bg-gold-vertical" />
        </div>
      </div>
    </Scaled>
  );
}
