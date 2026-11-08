import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Alert } from "../../components/Alert";
import { Button } from "../../components/Button";
import { FileDropzone } from "../../components/FileDropzone";
import { PageHeader } from "../../components/PageHeader";
import { SearchField } from "../../components/SearchField";
import { errorCode } from "../../lib/api";
import { PAGE_SIZE, type ImportPreview, type Participant } from "./api";
import { DeleteParticipantDialog } from "./DeleteParticipantDialog";
import { checkFile, messageFor } from "./files";
import { plural } from "./format";
import { ImportPreviewView } from "./ImportPreviewView";
import { ParticipantFormDialog } from "./ParticipantFormDialog";
import { ParticipantsSkeleton, ParticipantsTable } from "./ParticipantsTable";
import {
  participantsQueryOptions,
  useImportMutation,
  usePreviewMutation,
  useToggleMutation,
} from "./queries";
import type { ParticipantsSearch } from "./search";

const SUBTITLE =
  "Import your guest list. Each email becomes one entry in the draw.";
const SEARCH_DEBOUNCE_MS = 300;

type View =
  | { kind: "browse" }
  | { kind: "import" }
  | { kind: "preview"; file: File; preview: ImportPreview };

export function ParticipantsPage({
  search,
  onSearchChange,
}: {
  search: ParticipantsSearch;
  onSearchChange: (search: ParticipantsSearch) => void;
}) {
  const list = useQuery(participantsQueryOptions(search));
  const previewMutation = usePreviewMutation();
  const importMutation = useImportMutation();
  const toggleMutation = useToggleMutation();

  const [view, setView] = useState<View>({ kind: "browse" });
  const [dropError, setDropError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Participant | null>(null);
  const [deleting, setDeleting] = useState<Participant | null>(null);
  const [toggleFailed, setToggleFailed] = useState(false);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(new Set());

  // `isPending` lags a tick behind a click, so these refs are the synchronous guards against double
  // submits (a double click, a double Enter, a file chosen twice in quick succession).
  const busy = useRef(false);
  const toggling = useRef(new Set<number>());

  // The search box follows the URL (Back, refresh) and writes to it after a short pause.
  const [input, setInput] = useState(search.q);
  const committed = useRef(search.q);
  useEffect(() => {
    if (search.q !== committed.current) {
      committed.current = search.q;
      setInput(search.q);
    }
  }, [search.q]);
  useEffect(() => {
    if (input === committed.current) return;
    const id = setTimeout(() => {
      committed.current = input;
      onSearchChange({ q: input, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [input, onSearchChange]);

  // A page past the end (an old URL, or the list shrank) goes to the last page instead of showing nothing.
  const data = list.data;
  useEffect(() => {
    if (
      !data ||
      data.items.length > 0 ||
      data.matching === 0 ||
      search.page === 1
    )
      return;
    onSearchChange({
      q: search.q,
      page: Math.max(1, Math.ceil(data.matching / PAGE_SIZE)),
    });
  }, [data, search.q, search.page, onSearchChange]);

  async function chooseFile(file: File) {
    if (busy.current) return;
    setNotice(null);
    const rejected = checkFile(file);
    if (rejected) {
      setDropError(rejected);
      return;
    }
    busy.current = true;
    setDropError(null);
    try {
      const preview = await previewMutation.mutateAsync(file);
      setImportError(undefined);
      setView({ kind: "preview", file, preview });
    } catch (error) {
      setDropError(errorCode(error) ?? "unknown");
    } finally {
      busy.current = false;
    }
  }

  async function runImport() {
    if (busy.current || view.kind !== "preview") return;
    busy.current = true;
    setImportError(undefined);
    try {
      const result = await importMutation.mutateAsync(view.file);
      setNotice(
        `${plural(result.imported, "guest")} imported. ${plural(result.duplicates, "duplicate")} skipped.`,
      );
      setView({ kind: "browse" });
    } catch (error) {
      setImportError(messageFor(errorCode(error)).message);
    } finally {
      busy.current = false;
    }
  }

  async function toggle(participant: Participant) {
    if (toggling.current.has(participant.id)) return;
    toggling.current.add(participant.id);
    setPendingIds(new Set(toggling.current));
    setToggleFailed(false);
    try {
      await toggleMutation.mutateAsync({
        id: participant.id,
        disabled: !participant.disabled,
      });
    } catch {
      setToggleFailed(true);
    } finally {
      toggling.current.delete(participant.id);
      setPendingIds(new Set(toggling.current));
    }
  }

  const backToList = () => {
    setView({ kind: "browse" });
    setDropError(null);
  };

  const addButton = (
    <Button
      variant="secondary"
      onClick={() => {
        setNotice(null);
        setAdding(true);
      }}
    >
      Add participant
    </Button>
  );
  // The dialogs. Edit and delete only exist where the list does, but they are cheap to render closed.
  const addDialog = (
    <ParticipantFormDialog
      mode="add"
      open={adding}
      onClose={() => setAdding(false)}
      onDone={(name) => {
        setAdding(false);
        setNotice(`${name} added.`);
      }}
    />
  );
  const editDialogs = (
    <>
      {editing && (
        <ParticipantFormDialog
          mode="edit"
          participant={editing}
          open
          onClose={() => setEditing(null)}
          onDone={(name) => {
            setEditing(null);
            setNotice(`${name} updated.`);
          }}
        />
      )}
      <DeleteParticipantDialog
        participant={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(name) => {
          setDeleting(null);
          setNotice(`${name} deleted.`);
        }}
      />
    </>
  );

  // ---- Preview
  if (view.kind === "preview") {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Participants"
          subtitle="Check the file before anything is saved."
        />
        <ImportPreviewView
          preview={view.preview}
          importing={importMutation.isPending}
          error={importError}
          onImport={runImport}
          onChooseAnother={() => {
            setDropError(null);
            setView({ kind: "import" });
          }}
        />
      </div>
    );
  }

  // ---- First load, or the list could not be loaded
  if (!data) {
    if (list.isError) {
      return (
        <div className="flex flex-col gap-8">
          <PageHeader title="Participants" subtitle={SUBTITLE} />
          <div className="flex flex-col items-start gap-4">
            <Alert title="Could not load participants">Try again.</Alert>
            <Button variant="secondary" onClick={() => list.refetch()}>
              Retry
            </Button>
          </div>
        </div>
      );
    }
    // The Figma Loading frame: the page chrome is there, the data is not.
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Participants"
          subtitle={SUBTITLE}
          actions={
            <Button variant="secondary" disabled>
              Import file
            </Button>
          }
        />
        <div className="flex items-center justify-between gap-6">
          <SearchField
            label="Search participants"
            value={input}
            onChange={setInput}
            disabled
          />
          <p role="status" className="text-body-md text-gold-muted">
            Loading participants...
          </p>
        </div>
        <ParticipantsSkeleton />
      </div>
    );
  }

  // ---- Empty list, or the organizer chose "Import file": the dropzone
  if (data.total === 0 || view.kind === "import") {
    const dropzoneState = previewMutation.isPending
      ? "reading"
      : dropError
        ? "error"
        : "idle";
    const { title, message } = messageFor(dropError ?? undefined);
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Participants"
          subtitle={SUBTITLE}
          actions={data.total === 0 ? addButton : undefined}
        />
        <FileDropzone
          state={dropzoneState}
          title={title}
          message={message}
          onFile={chooseFile}
          onMultiple={() => setDropError("multiple_files")}
        />
        {data.total === 0 ? (
          // The Figma error frame shows the dropzone alone.
          dropzoneState !== "error" && (
            <p className="text-body-md text-gold-muted">
              No participants yet. Guests appear here after you import a file.
            </p>
          )
        ) : (
          <div>
            <Button variant="ghost" onClick={backToList}>
              Cancel
            </Button>
          </div>
        )}
        {addDialog}
      </div>
    );
  }

  // ---- The list
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Participants"
        subtitle={SUBTITLE}
        actions={
          <>
            {addButton}
            <Button
              variant="secondary"
              onClick={() => {
                setNotice(null);
                setDropError(null);
                setView({ kind: "import" });
              }}
            >
              Import file
            </Button>
          </>
        }
      />

      {notice && (
        <p
          role="status"
          className="rounded-md border border-gold-dim bg-gold-wash px-4 py-3 text-body-sm text-gold-300"
        >
          {notice}
        </p>
      )}
      {toggleFailed && (
        <Alert title="Could not update that guest.">Try again.</Alert>
      )}

      <div className="flex items-center justify-between gap-6">
        <SearchField
          label="Search participants"
          value={input}
          onChange={setInput}
          maxLength={100}
        />
        <p
          role="status"
          className="text-body-md whitespace-pre text-gold-muted"
        >
          {`${plural(data.total, "participant")}  ·  ${data.disabled.toLocaleString("en-US")} disabled`}
        </p>
      </div>

      {data.matching === 0 ? (
        <p className="text-body-md text-gold-muted">{`No guests match "${search.q}".`}</p>
      ) : (
        <ParticipantsTable
          items={data.items}
          matching={data.matching}
          page={search.page}
          pendingIds={pendingIds}
          onEdit={(participant) => {
            setNotice(null);
            setEditing(participant);
          }}
          onToggle={toggle}
          onDelete={(participant) => {
            setNotice(null);
            setDeleting(participant);
          }}
          onPageChange={(page) => onSearchChange({ q: search.q, page })}
        />
      )}
      {addDialog}
      {editDialogs}
    </div>
  );
}
