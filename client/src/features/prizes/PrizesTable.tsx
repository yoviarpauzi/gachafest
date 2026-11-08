import { tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { createContext, useContext, useMemo } from "react";
import { RowAction } from "../../components/RowAction";
import { StatusChip } from "../../components/StatusChip";
import type { Prize } from "./api";
import { formatRupiah } from "./format";

const features = tableFeatures({});

type RowActionHandlers = { onEdit: (prize: Prize) => void; onDelete: (prize: Prize) => void };
const RowActionsContext = createContext<RowActionHandlers | null>(null);

// The columns never change, so each cell keeps its identity from render to render and the row buttons are
// not remounted (a remount drops the keyboard focus). The handlers reach the buttons through context.
// Widths are the Figma row's: a fixed content width plus the 12px gap, with 16px at either end of the row.
const columns: ColumnDef<typeof features, Prize>[] = [
  {
    id: "handle",
    header: () => <span className="sr-only">Reorder</span>,
    cell: () => null,
  },
  {
    id: "rank",
    header: "#",
    cell: ({ row }) => <span className="text-label-md text-gold-muted">{row.index + 1}</span>,
  },
  {
    id: "name",
    header: "Prize",
    accessorKey: "name",
    cell: (info) => <span className="text-label-md text-ink">{info.getValue<string>()}</span>,
  },
  {
    id: "value",
    header: "Value",
    cell: ({ row }) => (
      <span className="text-body-md text-ink">
        {row.original.value === null ? "–" : formatRupiah(row.original.value)}
      </span>
    ),
  },
  {
    id: "winners",
    header: "Winners",
    accessorKey: "winners",
    cell: (info) => <span className="text-body-md text-ink">{info.getValue<number>()}</span>,
  },
  {
    id: "tier",
    header: "Tier",
    // A flex wrapper keeps the chip off the text baseline, so rows are 59px as in Figma.
    cell: ({ row }) => (
      <div className="flex">
        <StatusChip tone={row.original.tier === "premium" ? "active" : "file"}>
          {row.original.tier === "premium" ? "PREMIUM" : "BASIC"}
        </StatusChip>
      </div>
    ),
  },
  {
    id: "drawn",
    header: "Drawn",
    cell: ({ row }) => (
      <span className="text-body-md text-gold-muted">{`${row.original.drawn} of ${row.original.winners}`}</span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions prize={row.original} />,
  },
];

const widths: Record<string, string> = {
  handle: "w-13",
  rank: "w-13",
  name: "w-68",
  value: "w-43",
  winners: "w-28",
  tier: "w-33",
  drawn: "w-38",
};

// 16px before the first cell, 12px between cells, 16px after the last.
const padding = (id: string) => (id === "handle" ? "pl-4 pr-3" : id === "actions" ? "pr-4" : "pr-3");

function RowActions({ prize }: { prize: Prize }) {
  const actions = useContext(RowActionsContext);
  if (!actions) return null;
  return (
    <div className="flex justify-end gap-5">
      <RowAction busy={false} name={prize.name} onClick={() => actions.onEdit(prize)}>
        Edit
      </RowAction>
      <RowAction busy={false} name={prize.name} tone="danger" onClick={() => actions.onDelete(prize)}>
        Delete
      </RowAction>
    </div>
  );
}

export function PrizesTable({
  items,
  onEdit,
  onDelete,
}: {
  items: Prize[];
  onEdit: (prize: Prize) => void;
  onDelete: (prize: Prize) => void;
}) {
  const table = useTable({ features, columns, data: items });
  const actions = useMemo(() => ({ onEdit, onDelete }), [onEdit, onDelete]);

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
