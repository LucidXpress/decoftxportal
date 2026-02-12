# Security Audit (Post–Supabase Migration)

Summary of findings from a full codebase security scan. **Fix** = addressed in code; **Recommend** = action for you to take.

---

## Critical / High

### 1. Supabase RLS is fully permissive

**Finding:** All Row Level Security policies use `USING (true)` / `WITH CHECK (true)`, so anyone with the anon key can read and write every row in `users` and `appointments` via the Supabase Data API.

**Risk:** The anon key is in `NEXT_PUBLIC_*` env and is bundled in the client. Anyone who inspects the app can extract it and call Supabase directly, bypassing your Next.js API and NextAuth. They could read all users (including password hashes if they select that column) and all appointments.

**Current mitigation:** All database access in this app is done **server-side** (API routes and server components use `createClient()` from `@/lib/supabase/server`; auth uses `getSupabase()`). The browser Supabase client is not used for DB calls, so in normal use the key is not used from the client for data. The key is still present in the build (NEXT_PUBLIC), so the risk remains if someone uses it against your project.

**Recommend:** Tighten RLS so the anon key cannot read/write everything:

- Option A: **Service role only on server.** Use the Supabase **service_role** key only in server-side code (never expose it), and **disable anon access** or restrict anon to a minimal set of operations (e.g. no direct table access). Then the client never has a key that can access sensitive data.
- Option B: **RLS based on auth.** If you later use Supabase Auth (e.g. JWT from NextAuth), you can write RLS policies that allow access only for authenticated users and appropriate roles. Until then, the only safe approach is to use the service role on the server and not rely on anon for table access.

---

### 2. OneDrive link could allow `javascript:` (XSS)

**Finding:** OneDrive link is validated with `new URL(value)` (client) and Zod `z.string().url()` (API). Both accept any valid URL scheme, including `javascript:`. If a reception user entered e.g. `javascript:alert(1)` and it were stored, then rendered as `<a href="...">`, clicking could run script.

**Fix:** Restrict allowed URL schemes to `https:` (and optionally `http:` for dev). See changes in `src/lib/validation.ts` and API schemas below.

---

## Medium

### 3. Rate limiting is in-memory only

**Finding:** `src/lib/rate-limit.ts` uses in-memory `Map`s. On Vercel (serverless), each invocation can run in a different instance, so limits don’t aggregate across requests. An attacker could exceed the intended rate by sending many concurrent requests.

**Recommend:** For production, use a shared store (e.g. Redis/Upstash) or Vercel KV so rate limits are global. Keep the current implementation as a fallback when the store is unavailable.

---

### 4. No API rate limit on `/api/doctors`

**Finding:** `GET /api/appointments` and `POST/PATCH /api/appointments` and `GET/PATCH /api/appointments/[id]` use `checkRateLimit()`. `GET /api/doctors` does not.

**Recommend:** Add the same rate limit to `/api/doctors` for consistency and to limit enumeration.

---

### 5. `assigned_doctor_id` not validated as a doctor

**Finding:** When creating or updating an appointment, the API accepts any string for `assigned_doctor_id`. If it’s not a valid user ID or is a user with role `reception`, the DB may error (e.g. FK) or you could end up with a “doctor” that is actually reception.

**Recommend:** Before insert/update, check that `assigned_doctor_id` is either null or the id of a user with `role = 'doctor'` (e.g. query `users` by id and role). Return 400 with a clear message if not.

---

## Low / Informational

### 6. No middleware for protected routes

**Finding:** Protection is done per-route: dashboard and API handlers call `auth()` and redirect or return 401/403. There is no `middleware.ts` that protects `/dashboard` or `/api` globally.

**Recommend:** Add Next.js middleware that checks the session for `/dashboard` and `/api` (except auth routes) and redirects or returns 401. This gives defense in depth if a new route is added and someone forgets to add `auth()`.

---

### 7. Error logging in production

**Finding:** `src/app/dashboard/error.tsx` only logs the error object in development (`if (process.env.NODE_ENV === "development")`). No error details are sent to the client. Good.

---

### 8. Secrets and env

**Finding:**

- `AUTH_SECRET` is required in production (checked in `auth.ts`).
- `.gitignore` includes `.env*` and allows `.env.example` only. No secrets in repo.
- Only `NEXT_PUBLIC_SUPABASE_*` and `AUTH_SECRET` (and optional seed vars) are used. No service role key in code.

---

### 9. Auth and passwords

**Finding:**

- Passwords hashed with bcrypt (10 rounds) in seed and (if you add signup) should use the same.
- Credentials authorize: rate-limited by email, bcrypt compare, no password in JWT/session.
- Session is JWT, 30-day max age. Role and id stored in token and session.

---

### 10. Input validation

**Finding:** Appointment create/update use Zod schemas; invalid JSON and past appointment dates are rejected. Doctor filter and appointment-by-id access are role-checked (doctor sees only their own).

---

## Summary

| Priority   | Item                          | Status    |
|-----------|--------------------------------|-----------|
| Critical  | RLS permissive                 | Recommend |
| High      | OneDrive URL scheme (XSS)      | Fixed     |
| Medium    | In-memory rate limit           | Recommend |
| Medium    | Rate limit on /api/doctors     | Recommend |
| Medium    | Validate assigned_doctor_id    | Recommend |
| Low       | Middleware for protected routes| Recommend |
| Low       | Error handling / env / auth    | OK        |

After applying the OneDrive URL fix, the main follow-ups are: tighten Supabase RLS (or use service role only on server), then add shared rate limiting and the other recommendations as you harden production.
