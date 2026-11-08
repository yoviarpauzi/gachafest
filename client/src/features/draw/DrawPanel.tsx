import alertIcon from "../../assets/icons/icon-alert-circle.svg";
import { Button } from "../../components/Button";
import { MaskIcon } from "../../components/MaskIcon";
import { StatusChip } from "../../components/StatusChip";
import { formatRupiah } from "../prizes/format";
import type { DrawState } from "./api";

/**
 * The big panel: the prize being drawn and what to do next. Four faces of one panel, from the Figma frames:
 * Ready (press Draw), Drawing (the animation runs; Skip), Revealed (the winner is on the big screen; Done) and
 * No eligible guests. The page decides when there is nothing to show at all.
 */
export function DrawPanel({
  state,
  remaining,
  busy,
  failed,
  onDraw,
  onSkip,
  onDone,
}: {
  state: DrawState;
  /** Milliseconds of animation left, on the server's clock. */
  remaining: number;
  /** An action is in flight. */
  busy: boolean;
  failed: "draw" | "other" | null;
  onDraw: () => void;
  onSkip: () => void;
  onDone: () => void;
}) {
  const reveal = state.reveal;
  // While a winner is on screen the panel is about that winner's prize, not the next one.
  const prize = reveal ? reveal.prize : state.activePrize;
  if (!prize) return null;

  const drawing = reveal !== null && !reveal.skipped && remaining > 0;
  const noEligible = reveal === null && state.eligibleCount === 0;
  // The newest winner is not counted until the animation is over, so the progress does not give it away.
  const shownDrawn = Math.max(0, drawing ? prize.drawn - 1 : prize.drawn);

  return (
    <section
      aria-label="Draw"
      className="flex flex-col gap-6 rounded-xl border border-gold-dim bg-black-850 p-12"
    >
      <div className="flex items-center gap-3">
        <StatusChip tone={prize.tier === "premium" ? "active" : "file"}>
          {prize.tier === "premium" ? "PREMIUM" : "BASIC"}
        </StatusChip>
        <p className="text-body-sm text-gold-muted">{`Prize ${prize.position} of ${prize.total}`}</p>
      </div>

      <h2 className="font-display text-heading-xl text-ink">{prize.name}</h2>
      {prize.value !== null && (
        <p className="font-display text-heading-lg text-gold-metal">{formatRupiah(prize.value)}</p>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-body-md text-ink">{`${shownDrawn} of ${prize.winners} winners drawn`}</p>
        <div
          role="progressbar"
          aria-label="Winners drawn"
          aria-valuemin={0}
          aria-valuemax={prize.winners}
          aria-valuenow={shownDrawn}
          className="h-2 overflow-hidden rounded-full bg-black-700"
        >
          <div className="h-full bg-gold-metal" style={{ width: `${(shownDrawn / prize.winners) * 100}%` }} />
        </div>
      </div>

      {drawing && (
        <>
          <p role="status" className="sr-only">
            Drawing
          </p>
          <Button className="w-full" disabled>
            Drawing...
          </Button>
          {/* aria-disabled, not `disabled`: a disabled button cannot be focused, and the focus is handed on to it. */}
          <Button
            variant="ghost"
            className="w-full aria-disabled:opacity-50"
            data-focus="skip"
            aria-disabled={busy || undefined}
            onClick={onSkip}
          >
            Skip animation
          </Button>
        </>
      )}

      {reveal && !drawing && (
        <>
          <p role="status" className="sr-only">{`${reveal.winner.participantName} is showing on the big screen`}</p>
          <div className="flex flex-col gap-1 rounded-lg border border-gold-dim bg-black-950 p-6">
            <p className="text-body-sm text-gold-muted">Showing on the big screen</p>
            <p className="font-display text-heading-lg text-ink">{reveal.winner.participantName}</p>
          </div>
          <Button
            className="w-full aria-disabled:opacity-50"
            data-focus="done"
            aria-disabled={busy || undefined}
            onClick={onDone}
          >
            Done, back to Lucky Winners
          </Button>
          <p className="text-body-sm text-gold-muted">
            The big screen keeps showing the winner until you press Done.
          </p>
        </>
      )}

      {!reveal && (
        <>
          {noEligible && (
            <div role="alert" className="flex items-start gap-3 rounded-md border border-error bg-black-950 p-4">
              <span className="text-error">
                <MaskIcon src={alertIcon} className="size-6" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1 text-body-sm">
                <p className="text-label-md text-ink">No eligible guests left</p>
                <p className="text-gold-muted">
                  Every guest is disabled, or was already drawn or cancelled for this prize. Delete a cancelled winner
                  on the Winners page, re-enable a guest, or add participants.
                </p>
              </div>
            </div>
          )}
          <Button className="w-full" data-focus="draw" disabled={noEligible || busy} onClick={onDraw}>
            {busy ? "Drawing..." : "Draw"}
          </Button>
          <p className="text-center text-body-sm text-gold-muted">
            Draws one winner. The result is saved before the animation ends.
          </p>
        </>
      )}

      {failed && (
        <p role="alert" className="text-body-sm text-error">
          {failed === "draw" ? "Could not draw. Try again." : "Something went wrong. Try again."}
        </p>
      )}
    </section>
  );
}
