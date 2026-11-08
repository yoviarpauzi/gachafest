import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import prizesIcon from "../../assets/icons/icon-prizes.svg";
import { Alert } from "../../components/Alert";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import type { Prize } from "./api";
import { DeletePrizeDialog } from "./DeletePrizeDialog";
import { PrizeFormDialog } from "./PrizeFormDialog";
import { PrizesTable } from "./PrizesTable";
import { prizesQueryOptions } from "./queries";

const SUBTITLE = "Set how many winners each prize has and the order you draw them in.";

export function PrizesPage() {
  const list = useQuery(prizesQueryOptions);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Prize | null>(null);
  const [deleting, setDeleting] = useState<Prize | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const data = list.data;

  const startAdd = () => {
    setNotice(null);
    setAdding(true);
  };
  const startEdit = (prize: Prize) => {
    setNotice(null);
    setEditing(prize);
  };
  const startDelete = (prize: Prize) => {
    setNotice(null);
    setDeleting(prize);
  };

  // The dialogs are cheap to render closed, and every view that has prizes (or none) can open them.
  const dialogs = (
    <>
      <PrizeFormDialog
        mode="add"
        open={adding}
        onClose={() => setAdding(false)}
        onDone={(name) => {
          setAdding(false);
          setNotice(`${name} added.`);
        }}
      />
      {editing && (
        <PrizeFormDialog
          mode="edit"
          prize={editing}
          open
          onClose={() => setEditing(null)}
          onDone={(name) => {
            setEditing(null);
            setNotice(`${name} updated.`);
          }}
        />
      )}
      <DeletePrizeDialog
        prize={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(name) => {
          setDeleting(null);
          setNotice(`${name} deleted.`);
        }}
      />
    </>
  );

  const noticeLine = notice && (
    <p
      role="status"
      className="rounded-md border border-gold-dim bg-gold-wash px-4 py-3 text-body-sm text-gold-300"
    >
      {notice}
    </p>
  );

  // ---- First load, or the list could not be loaded
  if (!data) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Prizes" subtitle={SUBTITLE} />
        {list.isError ? (
          <div className="flex flex-col items-start gap-4">
            <Alert title="Could not load prizes">Try again.</Alert>
            <Button variant="secondary" onClick={() => list.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <p role="status" className="text-body-md text-gold-muted">
            Loading prizes...
          </p>
        )}
      </div>
    );
  }

  // ---- No prizes yet
  if (data.items.length === 0) {
    return (
      // Fills the screen below the header (the layout pads the page by 3rem top and bottom) so the empty
      // state sits in the middle of it, as in Figma.
      <div className="flex min-h-[calc(100dvh-6rem)] flex-col gap-8">
        <PageHeader title="Prizes" subtitle={SUBTITLE} />
        {noticeLine}
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={prizesIcon}
            title="No prizes yet"
            action={
              <Button size="md" onClick={startAdd}>
                Add prize
              </Button>
            }
          >
            Add the prizes you will draw, with how many winners each one has.
          </EmptyState>
        </div>
        {dialogs}
      </div>
    );
  }

  // ---- The list
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Prizes"
        subtitle={SUBTITLE}
        actions={
          <Button size="md" onClick={startAdd}>
            Add prize
          </Button>
        }
      />
      {noticeLine}
      <PrizesTable items={data.items} onEdit={startEdit} onDelete={startDelete} />
      <p className="text-body-sm text-gold-muted">
        Drag the handle to change the draw order. A prize cannot go below the winners it already has.
      </p>
      {dialogs}
    </div>
  );
}
