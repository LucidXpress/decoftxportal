# Decof Texas Portal

Internal scheduling and records portal for Decof Texas. Reception can schedule appointments, assign doctors, and attach OneDrive links to patient records. Doctors sign in to see their assigned appointments and open the linked OneDrive records.

- **No medical records are stored in this app.** All records stay in your HIPAA-compliant OneDrive; the portal only stores appointment-level data and links.
- **Auth:** Portal sign-in (email + password). Staff and doctors use portal-specific accounts, separate from Microsoft.
- **Roles:** Stored per user (reception vs doctor). Set when creating users (e.g. via seed or future admin).

## Tech stack

- **Next.js 16** (App Router), TypeScript, Tailwind CSS
- **Auth:** NextAuth v5 with Credentials provider (email/password), database sessions via Prisma
- **DB:** PostgreSQL (Prisma 6) — use [Supabase](https://supabase.com), [Neon](https://neon.tech), [Vercel Postgres](https://vercel.com/storage/postgres), or any Postgres host
- **Deploy:** Vercel (recommended)

## Setup

### 1. Clone and install

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in real values. **Never commit `.env.local` or any file containing real secrets.** The repo ignores `.env*` but allows `.env.example` (template only).

Edit `.env.local` with:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (e.g. from Supabase, Neon, or Vercel Postgres) |
| `AUTH_SECRET` | Random secret for sessions; e.g. `openssl rand -base64 32` |
| `PORTAL_SEED_PASSWORD` | (Optional) Password for seed users. Defaults to `changeme`. |
| `PORTAL_SEED_RECEPTION_EMAIL` | (Optional) Reception seed user email. Defaults to `reception@decoftexas.com`. |
| `PORTAL_SEED_DOCTOR_EMAIL` | (Optional) Doctor seed user email. Defaults to `doctor@decoftexas.com`. |

### 3. Database

Use any PostgreSQL host. **Supabase:** create a project at [supabase.com](https://supabase.com), then go to **Project Settings → Database**. Use the **Connection string (URI)** under "Connection pooling" (Transaction mode) for best compatibility with Prisma.

**If you get "invalid port number in database URL":** Your database password likely contains special characters (`@`, `:`, `#`, `/`, etc.). Put the password in the URL **URL-encoded** (e.g. `@` → `%40`, `:` → `%3A`, `#` → `%23`, `/` → `%2F`). Or set a new DB password in Supabase that uses only letters and numbers, then use that in the connection string.

```bash
# Create tables (no migration history)
npm run db:push

# Create initial portal users (reception + doctor) with the password from PORTAL_SEED_PASSWORD or "changeme"
npm run db:seed
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with one of the seed users (e.g. `reception@decoftexas.com` / `changeme`). Change the default password in production.

- **Reception:** Create and edit appointments, assign doctors, add/edit OneDrive links, mark completed/cancelled.
- **Doctors:** See only their assigned appointments and “Open records (OneDrive)” links.

## Presenting the draft to the client

- **Demo credentials (after seed):**
  - **Reception:** `reception@decoftexas.com` / `changeme` (or your `PORTAL_SEED_PASSWORD`)
  - **Doctor:** `doctor@decoftexas.com` / same password
- **Sample data:** Running `npm run db:seed` creates 5 sample appointments (scheduled, completed, cancelled; some today, some past/future) so the client can see filters, search, and the doctor calendar without creating data first.
- **What to show:** Sign in as reception → list, filters (All / Scheduled / Completed / Cancelled), Today toggle, search, New appointment, Edit, Mark completed, Cancel (with confirm). Sign in as doctor → calendar and event detail with OneDrive link.
- **Rate limiting:** Sign-in is limited to 5 attempts per email per 15 minutes; API to 30 requests per user per minute. If the client hits a limit during the demo, wait a few minutes or use a different email.

## Deploying to Vercel

For step-by-step instructions (database setup, env vars, first deploy, and seeding production), see **[DEPLOY.md](./DEPLOY.md)**.

Summary:

1. Push the repo to GitHub and import the project in [Vercel](https://vercel.com).
2. Create a Postgres database (Vercel Postgres, Supabase, or Neon) and set `DATABASE_URL` and `AUTH_SECRET` in Vercel → Settings → Environment Variables.
3. Deploy. After the first deploy, run **once** from your machine with the production `DATABASE_URL`: `npm run db:push` then `npx tsx prisma/seed.ts` (see DEPLOY.md for the exact commands).

Vercel is suitable for this app: it’s serverless, and the app does not store PHI—only appointment data and OneDrive links. Actual records remain in your HIPAA-compliant OneDrive.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Generate Prisma client and build Next.js |
| `npm run start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to DB (no migration files) |
| `npm run db:migrate` | Create and run migrations |
| `npm run db:seed` | Create initial reception + doctor users (see PORTAL_SEED_* in .env.local) |

## Notes

- **Doctors list:** The “Assign doctor” dropdown lists all users with role **doctor** in the database. Add doctor users via the seed (customize `PORTAL_SEED_DOCTOR_EMAIL`) or a future admin flow.
- **OneDrive links:** Reception creates the folder/link in OneDrive and pastes it into the portal. The app does not create or manage OneDrive content.
- **Branding:** You can align the UI with [decoftexas.com](https://decoftexas.com) by updating `src/app/globals.css` and component styles.

## Security

- **Secrets:** Never commit `.env.local`, `.env`, or any file with real keys or passwords. Use `.env.example` as a template only. In CI/deploy, inject env vars through the platform (e.g. Vercel Environment Variables).
- **`AUTH_SECRET`:** Must be set and kept secret. Generate with `openssl rand -base64 32`. Use a **different** value in production; rotate it if you suspect compromise (all sessions will be invalidated).
- **`DATABASE_URL`:** Use a strong database password. In production, use SSL (e.g. add `?sslmode=require` to the Postgres URL). Restrict DB access by IP if your host allows it.
- **Production:** Change the default seed password (`changeme`) before going live. Create real user accounts and avoid reusing the seed password for real staff.
- **Rate limiting:** Sign-in and API are rate-limited (see code) to reduce brute-force and abuse. For high-traffic or multi-instance deployments, consider a shared store (e.g. Redis) instead of in-memory limits.
- **Headers:** The app sets security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) via `next.config.ts`. Ensure the app is served over HTTPS in production.
