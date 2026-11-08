// The Figma icons carry fixed colors, so they are drawn as a mask and follow the current text color.
export function MaskIcon({ src, className = "size-5" }: { src: string; className?: string }) {
  // Quoted: Vite inlines small SVGs as data URIs, which are invalid inside an unquoted url().
  const mask = `url(${JSON.stringify(src)})`;
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 bg-current ${className}`}
      style={{
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}
