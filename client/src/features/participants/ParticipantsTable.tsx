import { rowPaginationFeature, tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
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
  onToggle: (participant: Participant) => void;
  onPageChange: (page: number) => void;
};

export function ParticipantsTable({ items, matching, page, pendingIds, onToggle, onPageChange }: Props) {
  const columns = useMemo<ColumnDef<typeof features, Participant>[]>(
    () => [
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
        cell: ({ row }) => (
          <StatusChip tone={row.original.disabled ? "disabled" : "active"}>
            {row.original.disabled ? "Disabled" : "Active"}
          </StatusChip>
        ),
      },
      {
        id: "action",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const participant = row.original;
          return (
            <button
              type="button"
              disabled={pendingIds.has(participant.id)}
              onClick={() => onToggle(participant)}
              className="rounded text-label-md text-gold-400 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-gold-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {participant.disabled ? "Enable" : "Disable"}
              <span className="sr-only"> {participant.name}</span>
            </button>
          );
        },
      },
    ],
    [pendingIds, onToggle],
  );

  const table = useTable({
    features,
    columns,
    data: items,
    manualPagination: true,
    rowCount: matching,
    state: { pagination: { pageIndex: page - 1, pageSize: PAGE_SIZE } },
  });
  const pageCount = Math.max(1, table.getPageCount());

  return (
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

      {pageCount > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-end gap-4">
          <Button variant="ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </Button>
          <span className="text-body-sm text-gold-muted">
            Page {page} of {pageCount}
          </span>
          <Button variant="ghost" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
            Next
          </Button>
        </nav>
      )}
    </div>
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
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-12 border-b border-black-700 px-4 py-5" aria-hidden="true">
          <span className="h-3.5 w-55 rounded-full bg-black-800 motion-safe:animate-pulse" />
          <span className="h-3.5 w-85 rounded-full bg-black-800 motion-safe:animate-pulse" />
          <span className="h-3.5 w-25 rounded-full bg-black-800 motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}
