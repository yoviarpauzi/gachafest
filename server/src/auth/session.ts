import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function digest(expiresAt: string, secret: string): string {
  return createHmac("sha256", secret).update(expiresAt).digest("hex");
}

export function signSession(expiresAt: number, secret: string): string {
  const value = String(expiresAt);
  return `${value}:${digest(value, secret)}`;
}

export function verifySession(token: unknown, secret: string, now: number): boolean {
  if (typeof token !== "string") return false;

  const parts = token.split(":");
  if (parts.length !== 2) return false;
  const [expiresAt, given] = parts as [string, string];
  if (!/^\d+$/.test(expiresAt)) return false;

  const expected = Buffer.from(digest(expiresAt, secret));
  const actual = Buffer.from(given);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;

  return Number(expiresAt) > now;
}
