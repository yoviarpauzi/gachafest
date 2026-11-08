import { useRef, useState } from "react";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { errorCode } from "../../lib/api";
import type { Winner } from "./api";
import { useDeleteWinnerMutation } from "./queries";

type Props = {
  /** The winner to delete; the dialog is open while this is set. */
  winner: Winner | null;
  onClose: () => void;
  onDeleted: (winnerName: string) => void;
};

/** The same confirmation pattern as cancelling: a question, what will happen, the safe button first. */
export function DeleteWinnerDialog({ winner, onClose, onDeleted }: Props) {
  return (
    <Modal open={winner !== null} onClose={onClose} title="Delete this winner?" size="sm" alert>
      {winner && <DeleteBody winner={winner} onClose={onClose} onDeleted={onDeleted} />}
    </Modal>
  );
}

function DeleteBody({
  winner,
  onClose,
  onDeleted,
}: {
  winner: Winner;
  onClose: () => void;
  onDeleted: (winnerName: string) => void;
}) {
  const remove = useDeleteWinnerMutation();
  const [error, setError] = useState<"on_screen" | "generic" | null>(null);
  // `isPending` lags a tick behind a click, so this ref is the guard against a double click.
  const deleting = useRef(false);

  async function confirm() {
    if (deleting.current) return;
    deleting.current = true;
    setError(null);
    try {
      await remove.mutateAsync(winner.id);
      onDeleted(winner.participantName);
    } catch (caught) {
      setError(errorCode(caught) === "on_screen" ? "on_screen" : "generic");
    } finally {
      deleting.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body-md text-gold-muted">
        This draw will be deleted for good, with no record left. {winner.participantName} can win{" "}
        {winner.prizeName} again. This cannot be undone.
      </p>
      {error && (
        <p role="alert" className="text-body-sm text-error">
          {error === "on_screen"
            ? "This winner is on the big screen. Press Done on the Draw page first."
            : "Something went wrong. Try again."}
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" disabled={remove.isPending} onClick={onClose}>
          Keep winner
        </Button>
        <Button type="button" size="md" disabled={remove.isPending} onClick={confirm}>
          {remove.isPending ? "Deleting..." : "Delete winner"}
        </Button>
      </div>
    </div>
  );
}
