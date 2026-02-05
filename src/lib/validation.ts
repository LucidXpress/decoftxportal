/** Returns true if the given ISO date string is in the past (before now). */
export function isPastDate(isoDate: string): boolean {
  return new Date(isoDate).getTime() < Date.now();
}

/** Basic URL check; empty string is valid (optional field). */
export function isValidOptionalUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}
