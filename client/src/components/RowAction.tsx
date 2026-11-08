import type { ReactNode } from "react";

/**
 * A text button in the last cell of a table row. `name` is read out after the label ("Edit Rina Pratama")
 * so a screen-reader user can tell the identical buttons of different rows apart.
 */
export function RowAction({
  busy,
  name,
  tone = "default",
  onClick,
  children,
}: {
  busy: boolean;
  name: string;
  tone?: "default" | "danger";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`rounded text-label-md outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-gold-300 disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "danger" ? "text-error" : "text-gold-400"
      }`}
    >
      {children}
      <span className="sr-only"> {name}</span>
    </button>
  );
}
