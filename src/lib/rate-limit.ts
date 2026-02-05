/**
 * In-memory rate limiter. Use for development/single-instance.
 * For production with multiple instances, use Redis or similar.
 */

const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30; // per window

function getKey(identifier: string, prefix: string): string {
  return `${prefix}:${identifier}`;
}

function cleanup(): void {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.resetAt < now) store.delete(key);
  }
}

export function checkRateLimit(
  identifier: string,
  prefix: string = "api"
): { allowed: boolean; remaining: number } {
  cleanup();
  const key = getKey(identifier, prefix);
  const now = Date.now();
  let entry = store.get(key);

  if (!entry) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    store.set(key, entry);
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  if (now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    store.set(key, entry);
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  entry.count += 1;
  const remaining = Math.max(0, MAX_REQUESTS - entry.count);
  return {
    allowed: entry.count <= MAX_REQUESTS,
    remaining,
  };
}

/** Stricter limit for auth (e.g. sign-in). */
const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_AUTH_ATTEMPTS = 5;

const authStore = new Map<string, { count: number; resetAt: number }>();

export function checkAuthRateLimit(identifier: string): { allowed: boolean } {
  const now = Date.now();
  for (const [key, value] of authStore.entries()) {
    if (value.resetAt < now) authStore.delete(key);
  }

  const entry = authStore.get(identifier);
  if (!entry) {
    authStore.set(identifier, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return { allowed: true };
  }
  if (now >= entry.resetAt) {
    authStore.set(identifier, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return { allowed: true };
  }
  entry.count += 1;
  return { allowed: entry.count <= MAX_AUTH_ATTEMPTS };
}
