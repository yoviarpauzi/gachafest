import ribbonUrl from "../../assets/screen/ribbon-shape.svg";
import { formatRupiah } from "../prizes/format";
import type { ScreenState } from "./api";
import { nameFontSize } from "./nameSize";
import { Scaled } from "./Scaled";

const WIDTH = 990;
const HEIGHT = 220;
// Space between the ribbon's folded ends, where the text goes.
const TEXT_WIDTH = 700;

/**
 * Figma `Prize ribbon`: the prize name over its value. A prize with no value shows only its name, large;
 * with no prize at all (every prize is drawn) the ribbon says so.
 */
export function PrizeRibbon({
  prize,
  scale = 1,
  textScale = scale,
  className = "",
}: {
  prize: ScreenState["prize"];
  /** Scale of the ribbon shape. */
  scale?: number;
  /** Scale of the text and its padding; the Drawing view grows these more than the ribbon itself (1.25 against 1.136). */
  textScale?: number;
  className?: string;
}) {
  const name = prize?.name ?? "All prizes drawn";
  const value = prize?.value ?? null;
  // The content is laid out at the ribbon's scale, so the text carries only the difference.
  const k = textScale / scale;

  return (
    <Scaled width={WIDTH} height={HEIGHT} scale={scale} className={className}>
      <div className="relative flex size-full flex-col items-center justify-center" style={{ paddingBottom: 34 * k }}>
        <img src={ribbonUrl} alt="" aria-hidden="true" className="absolute top-0 left-0 block h-55 w-247.5 max-w-none" />
        {value === null ? (
          <p
            className="relative max-w-175 text-center font-display leading-tight font-extrabold tracking-[-1.4px] text-balance text-black-950"
            style={{ fontSize: Math.min(70, nameFontSize(name, TEXT_WIDTH).fontSize) * k }}
          >
            {name}
          </p>
        ) : (
          <>
            <p
              className="relative max-w-175 text-center font-display font-semibold text-balance text-black-950"
              style={{ fontSize: 24 * k, lineHeight: `${30 * k}px` }}
            >
              {name}
            </p>
            <p
              className="relative font-display font-extrabold tracking-[-1.4px] whitespace-nowrap text-black-950"
              style={{ fontSize: 70 * k, lineHeight: `${78 * k}px` }}
            >
              {formatRupiah(value)}
            </p>
          </>
        )}
      </div>
    </Scaled>
  );
}
