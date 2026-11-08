import type { Winner } from "../winners/api";
import { formatTime } from "../winners/format";

/** The newest valid winners, newest first, with the prize and the time they were drawn. */
export function LatestWinners({ items }: { items: Winner[] }) {
  if (items.length === 0) return <p className="text-body-sm text-gold-muted">No winners yet.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {items.map((winner, index) => (
        <li key={winner.id} className="flex items-center gap-3 border-b border-black-700 px-4 py-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-black-800 text-label-sm text-ink">
            {index + 1}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-label-md text-ink">{winner.participantName}</span>
            <span className="text-body-sm text-gold-muted">{winner.prizeName}</span>
          </span>
          <span className="text-body-sm whitespace-nowrap text-gold-muted">{formatTime(winner.drawnAt)}</span>
        </li>
      ))}
    </ol>
  );
}
