import { Link } from "@tanstack/react-router";
import trophyUrl from "../../assets/screen/icon-trophy.svg";
import { formatRupiah } from "../prizes/format";
import type { ScreenState } from "./api";

// Figma `Lucky Winners panel` rows: the first is highlighted, 1 to 3 have a gold, silver or bronze medal.
const MEDAL = ["bg-gold-400 text-black-950", "bg-rank-silver text-black-950", "bg-rank-bronze text-black-950"] as const;
const PLAIN_MEDAL = "bg-black-800 text-ink";

/** The newest winners with the value of their prize, on the left of the Standby view. Full names, no email. */
export function LuckyWinners({ items, className = "" }: { items: ScreenState["latest"]; className?: string }) {
  return (
    <section
      aria-label="Lucky Winners"
      className={`flex min-h-192 w-140 flex-col items-start gap-4 rounded-xl border border-black-700 bg-black-850 p-6 ${className}`}
    >
      <div className="flex items-center gap-3">
        <img src={trophyUrl} alt="" aria-hidden="true" className="size-7" />
        <h2 className="font-display text-[20px] leading-7 font-semibold whitespace-nowrap text-ink">Lucky Winners</h2>
      </div>

      {items.length === 0 ? (
        <p className="font-sans text-[20px] leading-7.5 text-gold-muted">No winners yet</p>
      ) : (
        <ol className="flex w-full flex-col gap-1">
          {items.map((item, index) => (
            <li
              key={`${index}-${item.winnerName}-${item.prizeName}`}
              className={`flex items-center gap-4 rounded-md px-4 py-3 ${
                index === 0 ? "border border-gold-dim bg-gold-wash" : ""
              }`}
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full font-sans text-[14px] leading-5 font-medium ${
                  MEDAL[index] ?? PLAIN_MEDAL
                }`}
              >
                {index + 1}
              </span>
              <span className="min-w-px flex-1">
                <span className="line-clamp-3 block font-sans text-[20px] leading-7.5 break-words text-ink">{item.winnerName}</span>
                {item.prizeValue === null && (
                  <span className="line-clamp-2 block font-sans text-[14px] leading-5 break-words text-gold-muted">{item.prizeName}</span>
                )}
              </span>
              {item.prizeValue !== null && (
                <span
                  className={`shrink-0 font-sans text-[20px] leading-7.5 whitespace-nowrap ${
                    index === 0 ? "text-gold-300" : "text-gold-muted"
                  }`}
                >
                  {formatRupiah(item.prizeValue)}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      <Link
        to="/admin/winners"
        className="font-sans text-[14px] leading-5 font-medium text-gold-400 underline outline-offset-2 focus-visible:outline-2 focus-visible:outline-gold-300"
      >
        View all winners
      </Link>
    </section>
  );
}
