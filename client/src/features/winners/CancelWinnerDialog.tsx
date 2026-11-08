import { useRef, useState } from "react";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { errorCode } from "../../lib/api";
import type { Winner } from "./api";
import { useCancelWinnerMutation } from "./queries";

type Props = {
  /** The winner to cancel; the dialog is open while this is set. */
  winner: Winner | null;
  onClose: () => void;
  onCancelled: (winnerName: string) => void;
};

/** The Figma confirmation pattern: a question, what will happen, the safe button first. */
export function CancelWinnerDialog({ winner, onClose, onCancelled }: Props) {
  return (
    <Modal open={winner !== null} onClose={onClose} title="Cancel this winner?" size="sm" alert>
      {winner && <CancelBody winner={winner} onClose={onClose} onCancelled={onCancelled} />}
    </Modal>
  );
}

function CancelBody({
  winner,
  onClose,
  onCancelled,
}: {
  winner: Winner;
  onClose: () => void;
  onCancelled: (winnerName: string) => void;
}) {
  const cancel = useCancelWinnerMutation();
  const [failed, setFailed] = useState(false);
  // `isPending` lags a tick behind a click, so this ref is the guard against a double click.
  const cancelling = useRef(false);

  async function confirm() {
    if (cancelling.current) return;
    cancelling.current = true;
    setFailed(false);
    try {
      await cancel.mutateAsync(winner.id);
      onCancelled(winner.participantName);
    } catch (error) {
      // Cancelled already (in another tab) is what the organizer wanted, so it is not an error here.
      if (errorCode(error) === "already_cancelled") onCancelled(winner.participantName);
      else setFailed(true);
    } finally {
      cancelling.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body-md text-gold-muted">
        {winner.participantName} will be marked as cancelled and cannot win {winner.prizeName} again. You can
        redraw that slot afterwards.
      </p>
      {failed && (
        <p role="alert" className="text-body-sm text-error">
          Something went wrong. Try again.
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" disabled={cancel.isPending} onClick={onClose}>
          Keep winner
        </Button>
        <Button type="button" size="md" disabled={cancel.isPending} onClick={confirm}>
          {cancel.isPending ? "Cancelling..." : "Cancel winner"}
        </Button>
      </div>
    </div>
  );
}
