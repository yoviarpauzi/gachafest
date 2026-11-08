import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import winnersIcon from "../../assets/icons/icon-winners.svg";
import { Alert } from "../../components/Alert";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { errorCode } from "../../lib/api";
import { plural } from "../participants/format";
import { downloadWinnersCsv, type Winner } from "./api";
import { CancelWinnerDialog } from "./CancelWinnerDialog";
import { DeleteWinnerDialog } from "./DeleteWinnerDialog";
import { useDrawWinnerMutation, winnersQueryOptions } from "./queries";
import { WinnersTable } from "./WinnersTable";

const SUBTITLE = "Every draw is recorded here. Cancel a winner who is not in the room, then redraw that slot.";

type Problem = { title: string; text: string };

export function WinnersPage() {
  const list = useQuery(winnersQueryOptions);
  const draw = useDrawWinnerMutation();
  const navigate = useNavigate();

  const [cancelling, setCancelling] = useState<Winner | null>(null);
  const [deleting, setDeleting] = useState<Winner | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [exporting, setExporting] = useState(false);
  const [busyPrizeIds, setBusyPrizeIds] = useState<ReadonlySet<number>>(new Set());

  // `isPending` lags a tick behind a click, so these refs are the synchronous guards against a double click:
  // one redraw per prize at a time, one export at a time.
  const redrawing = useRef(new Set<number>());
  const exportingRef = useRef(false);

  const data = list.data;

  const clearMessages = () => {
    setNotice(null);
    setProblem(null);
  };

  async function redraw(winner: Winner) {
    if (redrawing.current.has(winner.prizeId)) return;
    redrawing.current.add(winner.prizeId);
    setBusyPrizeIds(new Set(redrawing.current));
    clearMessages();
    try {
      const drawn = await draw.mutateAsync(winner.prizeId);
      setNotice(`${drawn.participantName} drawn for ${drawn.prizeName}.`);
    } catch (error) {
      const code = errorCode(error);
      setProblem({
        title: "Could not redraw that slot.",
        text:
          code === "no_eligible"
            ? `No eligible guests are left for ${winner.prizeName}.`
            : code === "prize_full"
              ? "That prize has no open slot."
              : "Something went wrong. Try again.",
      });
    } finally {
      redrawing.current.delete(winner.prizeId);
      setBusyPrizeIds(new Set(redrawing.current));
    }
  }

  async function exportCsv() {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    clearMessages();
    try {
      await downloadWinnersCsv();
    } catch {
      setProblem({ title: "Could not export.", text: "Try again." });
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }

  const startCancel = (winner: Winner) => {
    clearMessages();
    setCancelling(winner);
  };

  const startDelete = (winner: Winner) => {
    clearMessages();
    setDeleting(winner);
  };

  const deleteDialog = (
    <DeleteWinnerDialog
      winner={deleting}
      onClose={() => setDeleting(null)}
      onDeleted={(name) => {
        setDeleting(null);
        setNotice(`${name} deleted.`);
      }}
    />
  );

  const cancelDialog = (
    <CancelWinnerDialog
      winner={cancelling}
      onClose={() => setCancelling(null)}
      onCancelled={(name) => {
        setCancelling(null);
        setNotice(`${name} cancelled.`);
      }}
    />
  );

  const messages = (
    <>
      {notice && (
        <p
          role="status"
          className="rounded-md border border-gold-dim bg-gold-wash px-4 py-3 text-body-sm text-gold-300"
        >
          {notice}
        </p>
      )}
      {problem && <Alert title={problem.title}>{problem.text}</Alert>}
    </>
  );

  // ---- First load, or the list could not be loaded
  if (!data) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Winners" subtitle={SUBTITLE} />
        {list.isError ? (
          <div className="flex flex-col items-start gap-4">
            <Alert title="Could not load winners">Try again.</Alert>
            <Button variant="secondary" onClick={() => list.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <p role="status" className="text-body-md text-gold-muted">
            Loading winners...
          </p>
        )}
      </div>
    );
  }

  // ---- Nothing drawn yet
  if (data.items.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-6rem)] flex-col gap-8">
        <PageHeader title="Winners" subtitle={SUBTITLE} />
        {messages}
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={winnersIcon}
            title="No winners yet"
            action={
              <Button size="md" onClick={() => navigate({ to: "/admin/draw" })}>
                Go to Draw
              </Button>
            }
          >
            Winners appear here as soon as you draw the first prize.
          </EmptyState>
        </div>
      </div>
    );
  }

  // ---- The list
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Winners"
        subtitle={SUBTITLE}
        actions={
          <Button variant="secondary" size="md" disabled={exporting} onClick={exportCsv}>
            {exporting ? "Exporting..." : "Export CSV"}
          </Button>
        }
      />
      {messages}
      <p role="status" className="text-body-md whitespace-pre text-gold-muted">
        {`${plural(data.draws, "draw")}  ·  ${data.cancelled.toLocaleString("en-US")} cancelled`}
      </p>
      <WinnersTable
        items={data.items}
        busyPrizeIds={busyPrizeIds}
        onCancel={startCancel}
        onRedraw={redraw}
        onDelete={startDelete}
      />
      {cancelDialog}
      {deleteDialog}
    </div>
  );
}
