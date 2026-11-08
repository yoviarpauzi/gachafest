import { useId, useRef, useState } from "react";
import uploadIcon from "../assets/icons/icon-upload.svg";
import { Button } from "./Button";
import { MaskIcon } from "./MaskIcon";

const IDLE_TITLE = "Drop your guest list here";
const IDLE_MESSAGE = "CSV or Excel, up to 10,000 rows and 5 MB. Columns: name and email.";

type Props = {
  state: "idle" | "reading" | "error";
  /** Shown in the error state. */
  title?: string;
  message?: string;
  onFile: (file: File) => void;
  /** Called when more than one file is dropped or chosen. */
  onMultiple?: () => void;
};

export function FileDropzone({ state, title, message, onFile, onMultiple }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const titleId = useId();
  const messageId = useId();

  const error = state === "error";
  const reading = state === "reading";

  function handleFiles(files: File[]) {
    if (reading || files.length === 0) return;
    if (files.length > 1) onMultiple?.();
    else onFile(files[0]!);
  }

  const heading = error ? title : reading ? "Reading file..." : IDLE_TITLE;
  const text = error ? message : IDLE_MESSAGE;
  const border = error ? "border-error" : dragging ? "border-gold-400" : "border-gold-dim";

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      aria-busy={reading}
      onDragOver={(event) => {
        event.preventDefault();
        if (!reading) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(Array.from(event.dataTransfer.files));
      }}
      className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed bg-black-850 px-8 py-12 text-center ${border}`}
    >
      <MaskIcon src={uploadIcon} className={`size-8 ${error ? "text-error" : "text-gold-400"}`} />
      <p id={titleId} className="font-display text-heading-sm text-ink">
        {heading}
      </p>
      <p
        id={messageId}
        role={error ? "alert" : undefined}
        className={`text-body-md ${error ? "text-error" : "text-gold-muted"}`}
      >
        {text}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          // Copy before resetting: clearing the value empties the live FileList, and the reset lets the
          // same file be chosen again.
          const picked = Array.from(event.target.files ?? []);
          event.target.value = "";
          handleFiles(picked);
        }}
      />
      <Button variant="secondary" disabled={reading} onClick={() => inputRef.current?.click()}>
        {error ? "Choose another file" : "Choose file"}
      </Button>
    </div>
  );
}
