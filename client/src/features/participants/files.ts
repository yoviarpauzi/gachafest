export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Quick checks before uploading; the server stays the authority. */
export function checkFile(
  file: File,
): "unsupported_file" | "file_too_large" | null {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".xlsx"))
    return "unsupported_file";
  if (file.size > MAX_FILE_BYTES) return "file_too_large";
  return null;
}

const CANT_USE = "That file can’t be used";

const messages: Record<string, { title: string; message: string }> = {
  unsupported_file: {
    title: CANT_USE,
    message: "Only .csv and .xlsx files are supported.",
  },
  file_too_large: { title: CANT_USE, message: "The file is larger than 5 MB." },
  too_many_rows: {
    title: CANT_USE,
    message: "The file has more than 10,000 rows.",
  },
  missing_columns: {
    title: CANT_USE,
    message: "The file needs a name column and an email column.",
  },
  multiple_files: { title: CANT_USE, message: "Drop one file at a time." },
};

export function messageFor(code: string | undefined): {
  title: string;
  message: string;
} {
  return (
    (code && messages[code]) || {
      title: "Something went wrong",
      message: "Something went wrong. Try again.",
    }
  );
}
