# Deploy to Vercel (client testing)

Follow these steps to get the portal live on Vercel so the client can test.

## 1. Push your code to GitHub

If you haven’t already:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_ORG/decoftxportal.git
git push -u origin main
```

(Use your actual repo URL and branch name.)

## 2. Create a production database

You need a **PostgreSQL** database. Two simple options:

- **Vercel Postgres** (same dashboard): [Vercel](https://vercel.com) → Storage → Create Database → Postgres. Copy the **`.env.local`** snippet or the connection string.
- **Supabase**: [supabase.com](https://supabase.com) → New project → Settings → Database → Connection string (URI). Use the **Transaction** pooler URL and add `?sslmode=require` if needed.

Save the connection string; you’ll add it to Vercel as `DATABASE_URL`.

## 3. Import the project in Vercel

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import your GitHub repo (e.g. `decoftxportal`).
3. Leave **Build Command** as default (uses `package.json`’s `build`: `prisma generate && next build`).
4. Do **not** deploy yet. Click **Environment Variables** (or go to Project → Settings → Environment Variables) and add the variables from the next step.

## 4. Set environment variables in Vercel

In the project → **Settings** → **Environment Variables**, add:

| Name            | Value                    | Environments   |
|-----------------|--------------------------|----------------|
| `DATABASE_URL`  | Your Postgres URL        | Production     |
| `AUTH_SECRET`   | `openssl rand -base64 32` | Production     |

Optional (for seed users; only used when you run the seed script):

| Name                         | Value                     | Environments |
|------------------------------|---------------------------|--------------|
| `PORTAL_SEED_PASSWORD`       | Password for demo users   | (not needed at build) |
| `PORTAL_SEED_RECEPTION_EMAIL`| e.g. `reception@decoftexas.com` | (not needed at build) |
| `PORTAL_SEED_DOCTOR_EMAIL`   | e.g. `doctor@decoftexas.com`    | (not needed at build) |

- **DATABASE_URL**: Paste the full Postgres connection string (with password). If the password has special characters, it must be URL-encoded.
- **AUTH_SECRET**: Generate once (e.g. run `openssl rand -base64 32` locally) and paste. Use a **different** value than in development.

Save and trigger a new deployment (Deployments → … on latest → Redeploy, or push a commit).

## 5. First deploy and database setup

1. Deploy the app (Deploy now, or push a commit after adding env vars).
2. The first build will run `prisma generate && next build`. The site will go live but **won’t have tables or users yet**, so sign-in will fail until you run the next step.

## 6. Create tables and seed users (one-time)

From your **local machine**, using the **production** `DATABASE_URL`:

```bash
# Replace with your actual production Postgres URL (from Vercel env or your DB provider)
export DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# Create tables
npm run db:push

# Create reception + doctor users (and sample appointments if DB is empty)
npx tsx prisma/seed.ts
```

- `db:push` creates/updates tables.
- `prisma/seed.ts` uses `DATABASE_URL` from the environment (and optionally `PORTAL_SEED_*` from `.env.local` or the same env). To set the seed password for production, run:

  ```bash
  DATABASE_URL="postgresql://..." PORTAL_SEED_PASSWORD="YourSecurePassword" npx tsx prisma/seed.ts
  ```

After this, the client can sign in at **https://your-project.vercel.app** with the reception and doctor emails (and the password you set or the default `changeme` if you didn’t override it).

## 7. Share with the client

- **URL**: `https://<your-project>.vercel.app` (or your custom domain if you added one).
- **Reception**: e.g. `reception@decoftexas.com` / password from seed.
- **Doctor**: e.g. `doctor@decoftexas.com` / same password.

Remind them to use a modern browser and that the link is for testing only (and to change the default password before real use).

## Troubleshooting

- **Build fails on Prisma**: Ensure `DATABASE_URL` is set in Vercel for the environment you’re building (Production/Preview). The build only runs `prisma generate`; it does not connect to the DB.
- **Sign-in fails after deploy**: You must run `db:push` and `db:seed` at least once with the production `DATABASE_URL` (step 6).
- **Invalid port number**: The DB password in `DATABASE_URL` likely contains special characters. URL-encode it (e.g. `@` → `%40`, `#` → `%23`) or use a password without special characters.
- **Rate limit**: If the client hits “Invalid email or password” repeatedly, they may be rate-limited (5 attempts per 15 min per email). Wait or use a different email.

## Optional: Custom domain

In Vercel: Project → Settings → Domains → Add (e.g. `portal.decoftexas.com`). Point DNS as Vercel instructs.
