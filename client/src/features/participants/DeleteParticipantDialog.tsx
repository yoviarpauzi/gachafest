import { useRef, useState } from "react";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { errorCode } from "../../lib/api";
import type { Participant } from "./api";
import { useDeleteParticipantMutation } from "./queries";

type Props = {
  /** The participant to delete; the dialog is open while this is set. */
  participant: Participant | null;
  onClose: () => void;
  onDeleted: (name: string) => void;
};

/** The Figma confirmation pattern: a question, what will happen, the safe button first. */
export function DeleteParticipantDialog({ participant, onClose, onDeleted }: Props) {
  return (
    <Modal open={participant !== null} onClose={onClose} title="Delete this participant?" size="sm" alert>
      {participant && (
        <DeleteBody participant={participant} onClose={onClose} onDeleted={onDeleted} />
      )}
    </Modal>
  );
}

function DeleteBody({
  participant,
  onClose,
  onDeleted,
}: {
  participant: Participant;
  onClose: () => void;
  onDeleted: (name: string) => void;
}) {
  const remove = useDeleteParticipantMutation();
  const [error, setError] = useState<"has_winners" | "generic" | null>(null);
  // `isPending` lags a tick behind a click, so this ref is the guard against a double click.
  const deleting = useRef(false);

  async function confirm() {
    if (deleting.current) return;
    deleting.current = true;
    setError(null);
    try {
      await remove.mutateAsync(participant.id);
      onDeleted(participant.name);
    } catch (caught) {
      setError(errorCode(caught) === "has_winners" ? "has_winners" : "generic");
    } finally {
      deleting.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body-md text-gold-muted">
        {participant.name} ({participant.email}) will be removed from the list and can no longer be
        drawn. This cannot be undone. To keep the guest but leave them out of the draw, disable them
        instead.
      </p>
      {error && (
        <p role="alert" className="text-body-sm text-error">
          {error === "has_winners"
            ? `${participant.name} has won a prize, so they can't be deleted. Disable them instead.`
            : "Something went wrong. Try again."}
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" disabled={remove.isPending} onClick={onClose}>
          Keep participant
        </Button>
        <Button type="button" size="md" disabled={remove.isPending} onClick={confirm}>
          {remove.isPending ? "Deleting..." : "Delete participant"}
        </Button>
      </div>
    </div>
  );
}
