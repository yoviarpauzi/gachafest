import type { ReactNode } from "react";

export function Alert({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-1 rounded-md border border-gold-500 bg-gold-wash p-4 text-body-sm"
    >
      <p className="text-label-md text-ink">{title}</p>
      <p className="text-gold-300">{children}</p>
    </div>
  );
}
