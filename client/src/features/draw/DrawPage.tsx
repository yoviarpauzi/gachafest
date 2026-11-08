import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Alert } from "../../components/Alert";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { StatusChip } from "../../components/StatusChip";
import { errorCode } from "../../lib/api";
import { prizesQueryOptions } from "../prizes/queries";
import prizesIcon from "../../assets/icons/icon-prizes.svg";
import winnersIcon from "../../assets/icons/icon-winners.svg";
import { winnersQueryOptions } from "../winners/queries";
import { useAnimationRemaining } from "./clock";
import { DrawPanel } from "./DrawPanel";
import { LatestWinners } from "./LatestWinners";
import { PrizeQueue } from "./PrizeQueue";
import {
  DRAW_POLL_MS,
  drawQueryOptions,
  useDoneMutation,
  useDrawMutation,
  useSelectPrizeMutation,
  useSkipMutation,
} from "./queries";

const SUBTITLE = "Pick a prize, press Draw, and the big screen plays the reveal.";
const LATEST_SIZE = 10;

// Answers that only mean "the page was out of date": the refetch that follows every action puts it right.
const QUIET = new Set(["reveal_pending", "not_revealing", "no_eligible", "no_open_prize", "prize_full"]);

export function DrawPage() {
  const draw = useQuery(drawQueryOptions);
  // The prize order and the winners are asked again with the draw state, so a second tab or window shows
  // the same counts and the same history as the one that pressed Draw.
  const prizes = useQuery({ ...prizesQueryOptions, refetchInterval: DRAW_POLL_MS });
  const winners = useQuery({ ...winnersQueryOptions, refetchInterval: DRAW_POLL_MS });
  const navigate = useNavigate();

  const select = useSelectPrizeMutation();
  const drawMutation = useDrawMutation();
  const skip = useSkipMutation();
  const done = useDoneMutation();

  const remaining = useAnimationRemaining(draw.data, draw.dataUpdatedAt);
  const state = draw.data;
  const drawing = state?.reveal != null && !state.reveal.skipped && remaining > 0;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<"draw" | "other" | null>(null);

  // `isPending` lags a tick behind a click, so this ref is the synchronous guard against a double click:
  // one action at a time, whichever button it came from.
  const acting = useRef(false);
  // Where the keyboard focus goes once the page has changed after an action.
  const pendingFocus = useRef<"skip" | "draw" | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    // The button the action leads to, or, when this state has none (every prize is drawn), the first button
    // the panel has, so the keyboard focus never falls to the top of the page.
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>(`[data-focus="${target}"]`) ?? panel?.querySelector("button"))?.focus();
  });

  // When the animation ends, by itself or by Skip, the Skip button disappears. If the focus was on it, or has
  // fallen to the page, it goes to the Done button, so the keyboard never loses its place.
  const wasDrawing = useRef(false);
  useEffect(() => {
    if (wasDrawing.current && !drawing) {
      const panel = panelRef.current;
      const active = document.activeElement;
      if (!active || active === document.body || panel?.contains(active)) {
        panel?.querySelector<HTMLElement>('[data-focus="done"]')?.focus();
      }
    }
    wasDrawing.current = drawing;
  }, [drawing]);

  async function run(action: () => Promise<unknown>, kind: "draw" | "other", focusAfter?: "skip" | "draw") {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    setFailed(null);
    try {
      await action();
      pendingFocus.current = focusAfter ?? null;
    } catch (error) {
      const code = errorCode(error);
      if (!code || !QUIET.has(code)) setFailed(kind);
    } finally {
      acting.current = false;
      setBusy(false);
    }
  }

  const prizeList = prizes.data?.items;

  // ---- Loading, or one of the three requests failed
  if (!state || !prizeList || !winners.data) {
    const failedToLoad = draw.isError || prizes.isError || winners.isError;
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Draw" subtitle={SUBTITLE} />
        {failedToLoad ? (
          <div className="flex flex-col items-start gap-4">
            <Alert title="Could not load the draw">Try again.</Alert>
            <Button
              variant="secondary"
              onClick={() => {
                void draw.refetch();
                void prizes.refetch();
                void winners.refetch();
              }}
            >
              Retry
            </Button>
          </div>
        ) : (
          <p role="status" className="text-body-md text-gold-muted">
            Loading the draw...
          </p>
        )}
      </div>
    );
  }

  const onScreenId = state.reveal?.winner.id ?? null;

  // The newest valid winners, without the one on the big screen until Done is pressed.
  const latest = winners.data.items
    .filter((w) => w.status === "valid" && w.id !== onScreenId)
    .sort((a, b) => b.drawnAt.localeCompare(a.drawnAt) || b.id - a.id)
    .slice(0, LATEST_SIZE);

  const badge = (
    <StatusChip tone={state.screenOpen ? "active" : "disabled"}>
      {state.screenOpen ? "Big screen open" : "Big screen not open"}
    </StatusChip>
  );

  // ---- No prizes at all
  if (prizeList.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-6rem)] flex-col gap-8">
        <PageHeader title="Draw" subtitle={SUBTITLE} actions={badge} />
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={prizesIcon}
            title="No prizes yet"
            action={
              <Button size="md" onClick={() => navigate({ to: "/admin/prizes" })}>
                Add prizes
              </Button>
            }
          >
            Add the prizes you will draw, with how many winners each one has.
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Draw" subtitle={SUBTITLE} actions={badge} />

      <div className="grid grid-cols-[minmax(0,1fr)_18.25rem] items-start gap-8">
        <div ref={panelRef}>
          {state.reveal || state.activePrize ? (
            <DrawPanel
              state={state}
              remaining={remaining}
              busy={busy}
              failed={failed}
              onDraw={() => run(() => drawMutation.mutateAsync(), "draw", "skip")}
              onSkip={() => run(() => skip.mutateAsync(), "other")}
              onDone={() => run(() => done.mutateAsync(), "other", "draw")}
            />
          ) : (
            <EmptyState
              icon={winnersIcon}
              title="All prizes are drawn"
              action={
                <Button size="md" onClick={() => navigate({ to: "/admin/winners" })}>
                  View winners
                </Button>
              }
            >
              Every prize has all its winners.
            </EmptyState>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-label-md text-gold-muted">Prize order</h2>
            <PrizeQueue
              prizes={prizeList}
              activeId={drawing ? (state.reveal?.prize.id ?? null) : (state.activePrize?.id ?? null)}
              selectable={state.phase !== "reveal"}
              pendingPrizeId={drawing ? (state.reveal?.prize.id ?? null) : null}
              onSelect={(id) => run(() => select.mutateAsync(id), "other")}
            />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-label-md text-gold-muted">Latest winners</h2>
            <LatestWinners items={latest} />
          </div>
        </aside>
      </div>
    </div>
  );
}
