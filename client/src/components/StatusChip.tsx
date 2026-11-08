import type { ReactNode } from "react";

type Tone = "active" | "disabled" | "file" | "cancelled";

const tones: Record<Tone, string> = {
  active: "border-gold-dim bg-gold-wash text-gold-300",
  disabled: "border-black-700 bg-black-800 text-ink",
  file: "border-black-700 bg-black-800 text-ink",
  // Outlined in red, with no fill: the Figma "Cancelled" chip.
  cancelled: "border-error text-error",
};

export function StatusChip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-label-sm whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
