import { useMemo } from "react";
import { makeConfetti } from "./confettiPieces";

const TONE = { gold: "bg-gold-400", cream: "bg-cream-100", bronze: "bg-gold-600" } as const;

/**
 * Figma `FX confetti`, falling. The pieces come from `makeConfetti(seed, count)`, so every screen shows the
 * same ones; the timeline reads each piece's numbers from its data attributes and moves it.
 */
export function Confetti({ seed, count }: { seed: string; count: number }) {
  const pieces = useMemo(() => makeConfetti(seed, count), [seed, count]);
  return (
    <div aria-hidden="true" data-fx="confetti" className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((piece, index) => (
        <span
          key={index}
          data-piece
          data-delay={piece.delay}
          data-duration={piece.duration}
          data-drift={piece.drift}
          data-rotation={piece.rotation}
          className={`absolute top-0 opacity-0 ${TONE[piece.tone]}`}
          style={{ left: piece.x, width: piece.width, height: piece.height }}
        />
      ))}
    </div>
  );
}
