import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

/**
 * A modal dialog on the native <dialog> element, which traps focus, closes on Escape, and returns focus
 * to the button that opened it. Its content is only mounted while open, so a form inside starts fresh.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // A click on the scrim lands on the <dialog> itself; clicks inside land on its children.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-130 max-w-[calc(100vw-2rem)] rounded-xl border border-black-700 bg-black-850 p-0 text-ink backdrop:bg-black-950/80"
    >
      {open && (
        <div className="flex flex-col gap-6 p-8">
          <h2 id={titleId} className="font-display text-heading-sm text-ink">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
