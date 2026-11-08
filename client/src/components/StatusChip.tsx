import type { ReactNode } from "react";

type Tone = "active" | "disabled" | "file";

const tones: Record<Tone, string> = {
  active: "border-gold-dim bg-gold-wash text-gold-300",
  disabled: "border-black-700 bg-black-800 text-ink",
  file: "border-black-700 bg-black-800 text-ink",
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
