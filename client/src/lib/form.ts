/** The message of a TanStack Form field error, which is a string or a Standard Schema issue object. */
export function issueMessage(error: unknown): string | undefined {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return undefined;
}
