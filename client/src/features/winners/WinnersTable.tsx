import { tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { createContext, useContext, useMemo } from "react";
import { RowAction } from "../../components/RowAction";
import { StatusChip } from "../../components/StatusChip";
import type { Winner } from "./api";
import { formatTime } from "./format";

const features = tableFeatures({});

type RowActionHandlers = {
  /** Prizes with a draw under way: their redraw buttons wait. */
  busyPrizeIds: ReadonlySet<number>;
  onCancel: (winner: Winner) => void;
  onRedraw: (winner: Winner) => void;
  onDelete: (winner: Winner) => void;
};
const RowActionsContext = createContext<RowActionHandlers | null>(null);

// The columns never change, so each cell keeps its identity and the row buttons are not remounted (a remount
// drops the keyboard focus). The handlers reach the buttons through context. Widths are the Figma row's: a
// fixed content width plus the 12px gap, with 16px at either end of the row.
const columns: ColumnDef<typeof features, Winner>[] = [
  {
    id: "prize",
    header: "Prize",
    accessorKey: "prizeName",
    cell: (info) => <span className="text-body-md text-gold-muted">{info.getValue<string>()}</span>,
  },
  {
    id: "winner",
    header: "Winner",
    accessorKey: "participantName",
    cell: (info) => <span className="text-label-md text-ink">{info.getValue<string>()}</span>,
  },
  {
    id: "time",
    header: "Drawn at",
    cell: ({ row }) => <span className="text-body-md text-gold-muted">{formatTime(row.original.drawnAt)}</span>,
  },
  {
    id: "status",
    header: "Status",
    // A flex wrapper keeps the chip off the text baseline, so rows are 59px as in Figma.
    cell: ({ row }) => (
      <div className="flex">
        <StatusChip tone={row.original.status === "valid" ? "active" : "cancelled"}>
          {row.original.status === "valid" ? "Valid" : "Cancelled"}
        </StatusChip>
      </div>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions winner={row.original} />,
  },
];

const widths: Record<string, string> = { prize: "w-62", winner: "w-68", time: "w-43", status: "w-38" };

// 16px before the first cell, 12px between cells, 16px after the last.
const padding = (id: string) => (id === "prize" ? "pl-4 pr-3" : id === "actions" ? "pr-4" : "pr-3");

function RowActions({ winner }: { winner: Winner }) {
  const actions = useContext(RowActionsContext);
  if (!actions) return null;
  const busy = actions.busyPrizeIds.has(winner.prizeId);
  return (
    <div className="flex items-center justify-end gap-4">
      {winner.status === "valid" ? (
        <RowAction busy={false} name={winner.participantName} onClick={() => actions.onCancel(winner)}>
          Cancel winner
        </RowAction>
      ) : (
        // A cancelled row offers a redraw only while its prize has a slot to fill.
        winner.prizeHasFreeSlot && (
          <RowAction busy={busy} name={winner.participantName} onClick={() => actions.onRedraw(winner)}>
            Redraw slot
          </RowAction>
        )
      )}
      {/* Cancelling keeps the row and blocks the guest from this prize; deleting removes it, so they can be drawn again. */}
      <RowAction busy={false} name={winner.participantName} tone="danger" onClick={() => actions.onDelete(winner)}>
        Delete
      </RowAction>
    </div>
  );
}

export function WinnersTable({
  items,
  busyPrizeIds,
  onCancel,
  onRedraw,
  onDelete,
}: {
  items: Winner[];
  busyPrizeIds: ReadonlySet<number>;
  onCancel: (winner: Winner) => void;
  onRedraw: (winner: Winner) => void;
  onDelete: (winner: Winner) => void;
}) {
  const table = useTable({ features, columns, data: items, getRowId: (winner) => String(winner.id) });
  const actions = useMemo(
    () => ({ busyPrizeIds, onCancel, onRedraw, onDelete }),
    [busyPrizeIds, onCancel, onRedraw, onDelete],
  );

  return (
    <RowActionsContext.Provider value={actions}>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          {columns.map((column) => (
            <col key={column.id} className={widths[column.id!]} />
          ))}
        </colgroup>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-black-700">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className={`${padding(header.column.id)} py-3 text-left text-label-sm font-medium text-gold-muted`}
                >
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
                <td key={c.id} className={`${padding(c.column.id)} py-4 align-middle`}>
                  <table.FlexRender cell={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </RowActionsContext.Provider>
  );
}
