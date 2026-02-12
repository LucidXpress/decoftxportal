/** Returns true if the given ISO date string is in the past (before now). */
export function isPastDate(isoDate: string): boolean {
  return new Date(isoDate).getTime() < Date.now();
}

const ALLOWED_URL_PROTOCOLS = ["https:", "http:"];

/** Returns true if the URL is valid and uses an allowed protocol (http/https only; blocks javascript:, data:, etc.). */
export function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ALLOWED_URL_PROTOCOLS.includes(u.protocol);
  } catch {
    return false;
  }
}

/** Optional URL check; empty string is valid. Only allows http/https to prevent javascript: or data: XSS. */
export function isValidOptionalUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return isAllowedUrl(trimmed);
}
