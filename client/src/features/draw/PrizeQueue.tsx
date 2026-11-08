import type { Prize } from "../prizes/api";
import { formatRupiah } from "../prizes/format";

/**
 * The prizes in the order they are drawn. The highlighted one is the prize the next draw is for; a prize with a
 * free slot can be clicked to make it the one. A prize whose last winner is still hidden behind the animation
 * (`pendingPrizeId`) is shown as it was before that draw, so the list does not give the result away.
 */
export function PrizeQueue({
  prizes,
  activeId,
  selectable,
  pendingPrizeId,
  onSelect,
}: {
  prizes: Prize[];
  activeId: number | null;
  selectable: boolean;
  pendingPrizeId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <ol className="flex flex-col gap-3">
      {prizes.map((prize, index) => {
        const drawn = prize.id === pendingPrizeId ? prize.drawn - 1 : prize.drawn;
        const done = drawn >= prize.winners;
        const active = prize.id === activeId;
        const canSelect = selectable && !done;
        // Not the `disabled` attribute: a button that becomes disabled loses the keyboard focus.
        return (
          <li key={prize.id}>
            <button
              type="button"
              aria-current={active ? "true" : undefined}
              aria-disabled={!canSelect}
              onClick={() => canSelect && onSelect(prize.id)}
              className={`flex w-full items-center gap-3 rounded-md px-4 py-3 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-gold-300 ${
                active ? "border-2 border-gold-400 bg-gold-wash" : "border border-black-700 bg-black-850"
              } ${canSelect ? "cursor-pointer hover:border-gold-500" : "cursor-default"}`}
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-label-sm ${
                  done
                    ? "border-gold-400 bg-gold-400 text-black-950"
                    : active
                      ? "border-gold-400 bg-gold-wash text-gold-300"
                      : "border-black-700 bg-black-800 text-ink"
                }`}
              >
                {index + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-label-md text-ink">{prize.name}</span>
                <span className="text-body-sm whitespace-pre-wrap text-gold-muted">
                  {`${prize.value === null ? "" : `${formatRupiah(prize.value)}  ·  `}${prize.winners} ${prize.winners === 1 ? "winner" : "winners"}`}
                </span>
              </span>
              <span className={`text-label-sm whitespace-nowrap ${done ? "text-gold-300" : "text-gold-muted"}`}>
                {`${drawn} of ${prize.winners}`}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
