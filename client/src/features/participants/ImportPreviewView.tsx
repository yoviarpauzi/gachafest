import { Button } from "../../components/Button";
import { StatusChip } from "../../components/StatusChip";
import { SummaryTile } from "../../components/SummaryTile";
import type { ImportPreview } from "./api";
import { plural } from "./format";

type Props = {
  preview: ImportPreview;
  importing: boolean;
  error?: string;
  onImport: () => void;
  onChooseAnother: () => void;
};

export function ImportPreviewView({
  preview,
  importing,
  error,
  onImport,
  onChooseAnother,
}: Props) {
  const { problems, problemsTotal } = preview;
  const nothingToImport = preview.valid === 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <StatusChip tone="file">{preview.fileName}</StatusChip>
        <span className="text-body-md text-gold-muted">
          {plural(preview.rowsRead, "row")} read
        </span>
      </div>

      <div className="flex gap-6">
        <SummaryTile label="Valid rows" value={preview.valid} />
        <SummaryTile
          label="Rows with problems"
          value={problemsTotal}
          tone={problemsTotal > 0 ? "problem" : "default"}
        />
        <SummaryTile label="Duplicates skipped" value={preview.duplicates} />
        <SummaryTile label="Total rows" value={preview.rowsRead} />
      </div>

      {problemsTotal > 0 && (
        <section className="overflow-hidden rounded-lg border border-black-700 bg-black-850">
          <h2 className="p-4 text-label-md text-ink">
            Rows to fix ({problemsTotal.toLocaleString("en-US")}). These rows
            are skipped.
          </h2>
          <ul>
            {problems.map((problem) => (
              <li
                key={problem.row}
                className="flex items-start gap-6 border-t border-black-700 px-4 py-3"
              >
                <span className="w-25 shrink-0 text-label-md text-ink">
                  Row {problem.row}
                </span>
                <span className="text-body-md text-error">
                  {problem.reason}
                </span>
              </li>
            ))}
          </ul>
          {problemsTotal > problems.length && (
            <p className="border-t border-black-700 px-4 py-3 text-body-sm text-gold-muted">
              Showing the first {problems.length} of{" "}
              {problemsTotal.toLocaleString("en-US")}.
            </p>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="md"
          disabled={importing || nothingToImport}
          onClick={onImport}
        >
          {importing
            ? "Importing..."
            : `Import ${plural(preview.valid, "guest")}`}
        </Button>
        <Button variant="ghost" disabled={importing} onClick={onChooseAnother}>
          Choose another file
        </Button>
        <p className="text-body-sm text-gold-muted">
          {nothingToImport
            ? "No valid rows to import."
            : "Duplicates are matched by email, so each email becomes one entry."}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
