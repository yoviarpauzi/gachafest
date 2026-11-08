import type { ReactNode } from "react";

/**
 * Lays out `children` at their Figma size (`width` by `height`) and scales the result, so a component drawn
 * once can sit on the stage at the larger size the Drawing view uses. The box it takes up is the scaled one.
 */
export function Scaled({
  width,
  height,
  scale,
  className = "",
  children,
}: {
  width: number;
  height: number;
  scale: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className} style={{ width: width * scale, height: height * scale }}>
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}
