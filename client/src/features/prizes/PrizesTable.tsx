import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import gripIcon from "../../assets/icons/icon-grip.svg";
import { MaskIcon } from "../../components/MaskIcon";
import { RowAction } from "../../components/RowAction";
import { StatusChip } from "../../components/StatusChip";
import type { Prize } from "./api";
import { formatRupiah } from "./format";

const features = tableFeatures({});

type RowActionHandlers = {
  onEdit: (prize: Prize) => void;
  onDelete: (prize: Prize) => void;
};
const RowActionsContext = createContext<RowActionHandlers | null>(null);

// What a row's drag handle needs from the row's `useSortable`, passed down by context so the columns can
// stay defined once at module level.
type SortableHandle = {
  setActivatorNodeRef: (element: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  disabled: boolean;
};
const SortableHandleContext = createContext<SortableHandle | null>(null);

// The columns never change, so each cell keeps its identity from render to render and the row buttons are
// not remounted (a remount drops the keyboard focus, which a drag must keep on its handle). The handlers
// reach the buttons through context. Widths are the Figma row's: a fixed content width plus the 12px gap,
// with 16px at either end of the row.
const columns: ColumnDef<typeof features, Prize>[] = [
  {
    id: "handle",
    header: () => <span className="sr-only">Reorder</span>,
    cell: ({ row }) => <DragHandle prize={row.original} />,
  },
  {
    id: "rank",
    header: "#",
    cell: ({ row }) => (
      <span className="text-label-md text-gold-muted">{row.index + 1}</span>
    ),
  },
  {
    id: "name",
    header: "Prize",
    accessorKey: "name",
    cell: (info) => (
      <span className="text-label-md text-ink">{info.getValue<string>()}</span>
    ),
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
    cell: (info) => (
      <span className="text-body-md text-ink">{info.getValue<number>()}</span>
    ),
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
const padding = (id: string) =>
  id === "handle" ? "pl-4 pr-3" : id === "actions" ? "pr-4" : "pr-3";

function DragHandle({ prize }: { prize: Prize }) {
  const handle = useContext(SortableHandleContext);
  if (!handle) return null;
  const { setActivatorNodeRef, attributes, listeners } = handle;
  // Not the `disabled` attribute: a button that becomes disabled loses the keyboard focus, and the handle is
  // disabled for the moment the new order is being saved, right after a drop. `useSortable({ disabled })`
  // already sets `aria-disabled` and leaves out the listeners, so a disabled handle does nothing.
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Reorder ${prize.name}`}
      className="flex size-6 cursor-grab touch-none items-center justify-center rounded text-gold-muted outline-offset-2 hover:text-gold-400 focus-visible:outline-2 focus-visible:outline-gold-300 active:cursor-grabbing aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      <MaskIcon src={gripIcon} className="size-6" />
    </button>
  );
}

function RowActions({ prize }: { prize: Prize }) {
  const actions = useContext(RowActionsContext);
  if (!actions) return null;
  return (
    <div className="flex justify-end gap-5">
      <RowAction
        busy={false}
        name={prize.name}
        onClick={() => actions.onEdit(prize)}
      >
        Edit
      </RowAction>
      <RowAction
        busy={false}
        name={prize.name}
        tone="danger"
        onClick={() => actions.onDelete(prize)}
      >
        Delete
      </RowAction>
    </div>
  );
}

function SortableRow({
  prize,
  disabled,
  children,
}: {
  prize: Prize;
  disabled: boolean;
  children: ReactNode;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: prize.id, disabled });
  const handle = useMemo(
    () => ({ setActivatorNodeRef, attributes, listeners, disabled }),
    [setActivatorNodeRef, attributes, listeners, disabled],
  );

  return (
    <SortableHandleContext.Provider value={handle}>
      <tr
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={`border-b border-black-700 ${isDragging ? "relative z-10 bg-black-900" : ""}`}
      >
        {children}
      </tr>
    </SortableHandleContext.Provider>
  );
}

export function PrizesTable({
  items,
  onEdit,
  onDelete,
  onReorder,
  reorderDisabled,
}: {
  items: Prize[];
  onEdit: (prize: Prize) => void;
  onDelete: (prize: Prize) => void;
  /** Called with every prize id in the new draw order after a drop that changed it. */
  onReorder: (ids: number[]) => void;
  /** True while an order is being saved; the handles do nothing until it is done. */
  reorderDisabled: boolean;
}) {
  // Rows are keyed by prize id: the default key is the row's index, which would follow the position, not
  // the prize, and a moved row would be remounted and lose focus.
  const table = useTable({
    features,
    columns,
    data: items,
    getRowId: (prize) => String(prize.id),
  });
  const actions = useMemo(() => ({ onEdit, onDelete }), [onEdit, onDelete]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const nameOf = (id: unknown) =>
    items.find((prize) => prize.id === id)?.name ?? "Prize";
  const positionOf = (id: unknown) =>
    items.findIndex((prize) => prize.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${nameOf(active.id)}. Position ${positionOf(active.id)} of ${items.length}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} moved to position ${positionOf(over.id)} of ${items.length}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      `${nameOf(active.id)} dropped at position ${positionOf(over?.id ?? active.id)} of ${items.length}.`,
    onDragCancel: () => "Reordering cancelled.",
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((prize) => prize.id === active.id);
    const to = items.findIndex((prize) => prize.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to).map((prize) => prize.id));
  }

  return (
    <RowActionsContext.Provider value={actions}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "Press Space to pick up, the arrow keys to move, Space to drop, Escape to cancel.",
          },
        }}
      >
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
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <SortableContext
            items={items.map((prize) => prize.id)}
            strategy={verticalListSortingStrategy}
          >
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <SortableRow
                  key={row.id}
                  prize={row.original}
                  disabled={reorderDisabled}
                >
                  {row.getAllCells().map((c) => (
                    <td
                      key={c.id}
                      className={`${padding(c.column.id)} py-4 align-middle`}
                    >
                      <table.FlexRender cell={c} />
                    </td>
                  ))}
                </SortableRow>
              ))}
            </tbody>
          </SortableContext>
        </table>
      </DndContext>
    </RowActionsContext.Provider>
  );
}
