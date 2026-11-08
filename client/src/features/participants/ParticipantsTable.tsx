import { rowPaginationFeature, tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { Button } from "../../components/Button";
import { StatusChip } from "../../components/StatusChip";
import { PAGE_SIZE, type Participant } from "./api";

const features = tableFeatures({ rowPaginationFeature });

const headCell = "px-4 py-3 text-left text-label-sm font-medium text-gold-muted";
const cell = "px-4 py-4 align-middle";

type Props = {
  items: Participant[];
  matching: number;
  page: number;
  pendingIds: ReadonlySet<number>;
  onEdit: (participant: Participant) => void;
  onToggle: (participant: Participant) => void;
  onDelete: (participant: Participant) => void;
  onPageChange: (page: number) => void;
};

type RowActionHandlers = Pick<Props, "pendingIds" | "onEdit" | "onToggle" | "onDelete">;
const RowActionsContext = createContext<RowActionHandlers | null>(null);

// The columns never change, so each cell keeps its identity from render to render and the row buttons are
// not remounted. A remount would drop the keyboard focus, and with it the place a dialog returns focus to.
// The handlers and the pending ids reach the buttons through context instead of through these closures.
const columns: ColumnDef<typeof features, Participant>[] = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    cell: (info) => <span className="text-label-md text-ink">{info.getValue<string>()}</span>,
  },
  {
    id: "email",
    header: "Email",
    accessorKey: "email",
    cell: (info) => <span className="text-body-md text-gold-muted">{info.getValue<string>()}</span>,
  },
  {
    id: "status",
    header: "Status",
    // A flex wrapper keeps the chip off the text baseline, so rows are 59px as in Figma.
    cell: ({ row }) => (
      <div className="flex">
        <StatusChip tone={row.original.disabled ? "disabled" : "active"}>
          {row.original.disabled ? "Disabled" : "Active"}
        </StatusChip>
      </div>
    ),
  },
  {
    id: "action",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions participant={row.original} />,
  },
];

function RowActions({ participant }: { participant: Participant }) {
  const actions = useContext(RowActionsContext);
  if (!actions) return null;
  const busy = actions.pendingIds.has(participant.id);
  return (
    <div className="flex justify-end gap-5">
      <RowAction busy={busy} name={participant.name} onClick={() => actions.onEdit(participant)}>
        Edit
      </RowAction>
      <RowAction busy={busy} name={participant.name} onClick={() => actions.onToggle(participant)}>
        {participant.disabled ? "Enable" : "Disable"}
      </RowAction>
      <RowAction
        busy={busy}
        name={participant.name}
        tone="danger"
        onClick={() => actions.onDelete(participant)}
      >
        Delete
      </RowAction>
    </div>
  );
}

export function ParticipantsTable({
  items,
  matching,
  page,
  pendingIds,
  onEdit,
  onToggle,
  onDelete,
  onPageChange,
}: Props) {
  const table = useTable({
    features,
    columns,
    data: items,
    manualPagination: true,
    rowCount: matching,
    state: { pagination: { pageIndex: page - 1, pageSize: PAGE_SIZE } },
  });
  const pageCount = Math.max(1, table.getPageCount());
  const firstShown = (page - 1) * PAGE_SIZE + 1;
  const lastShown = firstShown + items.length - 1;

  const actions = useMemo(
    () => ({ pendingIds, onEdit, onToggle, onDelete }),
    [pendingIds, onEdit, onToggle, onDelete],
  );

  return (
    <RowActionsContext.Provider value={actions}>
      <div className="flex flex-col gap-4">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-65" />
            <col className="w-95" />
            <col className="w-35" />
            <col />
          </colgroup>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-black-700">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} scope="col" className={headCell}>
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-black-700">
                {row.getAllCells().map((c) => (
                  <td key={c.id} className={`${cell} ${c.column.id === "action" ? "text-right" : ""}`}>
                    <table.FlexRender cell={c} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Always shown, so it is clear there is paging even while everything fits on one page. */}
        <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
          <p className="text-body-sm text-gold-muted">
            {items.length > 0 &&
              `Showing ${firstShown.toLocaleString("en-US")}–${lastShown.toLocaleString("en-US")} of ${matching.toLocaleString("en-US")}`}
          </p>
          <div className="flex items-center gap-4">
            <Button variant="ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              Previous
            </Button>
            <span className="text-body-sm text-gold-muted">
              Page {page} of {pageCount}
            </span>
            <Button variant="ghost" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
              Next
            </Button>
          </div>
        </nav>
      </div>
    </RowActionsContext.Provider>
  );
}

function RowAction({
  busy,
  name,
  tone = "default",
  onClick,
  children,
}: {
  busy: boolean;
  name: string;
  tone?: "default" | "danger";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`rounded text-label-md outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-gold-300 disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "danger" ? "text-error" : "text-gold-400"
      }`}
    >
      {children}
      <span className="sr-only"> {name}</span>
    </button>
  );
}

export function ParticipantsSkeleton() {
  return (
    <div role="status" aria-label="Loading participants" className="flex flex-col">
      <div className={`${headCell} border-b border-black-700`} aria-hidden="true">
        <span className="inline-block w-65">Name</span>
        <span className="inline-block w-95">Email</span>
        <span className="inline-block w-35">Status</span>
      </div>
      {/* Same column widths as the real table, rows 61px as in Figma. */}
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="flex h-15.25 items-center border-b border-black-700 px-4"
          aria-hidden="true"
        >
          <span className="w-65">
            <span className="block h-3.5 w-55 rounded-full bg-black-800 motion-safe:animate-pulse" />
          </span>
          <span className="w-95">
            <span className="block h-3.5 w-85 rounded-full bg-black-800 motion-safe:animate-pulse" />
          </span>
          <span className="w-35">
            <span className="block h-3.5 w-25 rounded-full bg-black-800 motion-safe:animate-pulse" />
          </span>
        </div>
      ))}
    </div>
  );
}
