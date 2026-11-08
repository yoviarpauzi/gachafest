import type { ReactNode } from "react";
import { MaskIcon } from "./MaskIcon";

/** What a page shows when there is nothing yet: an icon, what is missing, and the one way to fix it. */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-120 max-w-full flex-col items-center gap-4 p-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-full border border-gold-dim bg-gold-wash text-gold-400">
        <MaskIcon src={icon} className="size-7" />
      </div>
      <h2 className="font-display text-heading-sm text-ink">{title}</h2>
      <p className="text-body-md text-gold-muted">{children}</p>
      {action}
    </div>
  );
}
