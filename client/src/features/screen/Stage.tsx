import { useEffect, useState, type ReactNode } from "react";

export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

const fit = () => Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);

/**
 * A fixed 1920 by 1080 canvas scaled to fit the window, centered on black. Everything inside uses the Figma
 * pixel values; the window can be any size and the page never scrolls.
 */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(fit);

  useEffect(() => {
    const observer = new ResizeObserver(() => setScale(fit()));
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black-950">
      <div
        className="absolute top-1/2 left-1/2 origin-center overflow-hidden"
        style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
