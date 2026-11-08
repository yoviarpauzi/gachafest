import { useEffect, useState } from "react";
import { estimateWidthEm, type Measure } from "./nameSize";

const FONT = '800 100px "Montserrat Variable"';

let context: CanvasRenderingContext2D | null | undefined;

function measureWithCanvas(text: string): number {
  context ??= document.createElement("canvas").getContext("2d");
  if (!context) return estimateWidthEm(text);
  context.font = FONT;
  // 3% on top: the page lays text out with letter spacing and subpixel positions the canvas does not know about.
  return (context.measureText(text).width / 100) * 1.03;
}

/**
 * How wide a text is in the screen's font, so a name is sized to what it really takes and not to a guess. Until
 * the font has loaded (the canvas would measure a fallback font) it answers with the wide estimate, then the
 * component renders again with the real widths.
 */
export function useTextMeasure(): Measure {
  const [ready, setReady] = useState(() => document.fonts?.check(FONT) === true);

  useEffect(() => {
    if (ready || !document.fonts) return;
    let alive = true;
    document.fonts.load(FONT).then(
      () => alive && setReady(true),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [ready]);

  return ready ? measureWithCanvas : estimateWidthEm;
}
