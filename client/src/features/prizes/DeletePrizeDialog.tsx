import { useRef, useState } from "react";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import type { Prize } from "./api";
import { useDeletePrizeMutation } from "./queries";

type Props = {
  /** The prize to delete; the dialog is open while this is set. */
  prize: Prize | null;
  onClose: () => void;
  onDeleted: (name: string) => void;
};

/** The Figma confirmation pattern: a question, what will happen, the safe button first. */
export function DeletePrizeDialog({ prize, onClose, onDeleted }: Props) {
  return (
    <Modal open={prize !== null} onClose={onClose} title="Delete this prize?" size="sm" alert>
      {prize && <DeleteBody prize={prize} onClose={onClose} onDeleted={onDeleted} />}
    </Modal>
  );
}

function DeleteBody({
  prize,
  onClose,
  onDeleted,
}: {
  prize: Prize;
  onClose: () => void;
  onDeleted: (name: string) => void;
}) {
  const remove = useDeletePrizeMutation();
  const [failed, setFailed] = useState(false);
  // `isPending` lags a tick behind a click, so this ref is the guard against a double click.
  const deleting = useRef(false);

  async function confirm() {
    if (deleting.current) return;
    deleting.current = true;
    setFailed(false);
    try {
      await remove.mutateAsync(prize.id);
      onDeleted(prize.name);
    } catch {
      setFailed(true);
    } finally {
      deleting.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body-md text-gold-muted">
        {prize.name} will be removed from the draw. This cannot be undone.
      </p>
      {failed && (
        <p role="alert" className="text-body-sm text-error">
          Something went wrong. Try again.
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" disabled={remove.isPending} onClick={onClose}>
          Keep prize
        </Button>
        <Button type="button" size="md" disabled={remove.isPending} onClick={confirm}>
          {remove.isPending ? "Deleting..." : "Delete prize"}
        </Button>
      </div>
    </div>
  );
}
