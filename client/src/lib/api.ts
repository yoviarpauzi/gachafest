export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  // FormData needs the browser to write its own multipart content-type, boundary included.
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const res = await fetch(path, { ...init, headers, credentials: "same-origin" });
  const body = await readBody(res);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

/** The parsed JSON body of a failed response, if there was one. */
export function errorBody(error: unknown): Record<string, unknown> | undefined {
  if (!(error instanceof ApiError)) return undefined;
  return error.body && typeof error.body === "object" ? (error.body as Record<string, unknown>) : undefined;
}

/** The `error` code the server put in a failed response, if any. */
export function errorCode(error: unknown): string | undefined {
  const code = errorBody(error)?.error;
  return typeof code === "string" ? code : undefined;
}
