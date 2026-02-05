# Supabase + Vercel setup (from scratch)

Follow these steps in order. Do not skip steps.

---

## Part 1: Get the correct connection string from Supabase

1. **Open Supabase**  
   Go to [supabase.com](https://supabase.com) and open your project (the one with `db.zprmproyrdwypiqkqpxd`).

2. **Open connection settings**  
   In the left sidebar: **Project Settings** (gear icon at bottom) → **Database**.

3. **Find your database password**  
   Under **Database password**, you’ll see either a masked password or a **Reset database password** button.
   - If you don’t know the password: click **Reset database password**, set a new one, and **save it somewhere** (e.g. a password manager).  
   - Example: `MySecurePass123` (no special characters like `@` or `#` makes the URL simpler.)

4. **Get the Session Pooler URL (required for Vercel)**  
   - Scroll to **Connection string** or **Connection pooling**.
   - Choose **URI** (or “Connection string”).
   - Choose **Session** (or **Transaction** / “Session pooler”) — **not** “Direct connection”.  
     Vercel is IPv4; Supabase’s direct connection is not IPv4 compatible, so the app must use the pooler.
   - Copy the template. It will look like:
     ```text
     postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
     ```
     Or sometimes:
     ```text
     postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:6543/postgres
     ```
   - Replace `[YOUR-PASSWORD]` with your **actual** database password.  
     If the password contains `@`, `#`, `/`, or `:`, URL-encode it (e.g. `@` → `%40`, `#` → `%23`).
   - **Save this full URL** — this is your **DATABASE_URL** for Vercel.  
     Example (fake password):  
     `postgresql://postgres:MySecurePass123@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

---

## Part 2: Set environment variables in Vercel

1. **Open Vercel**  
   Go to [vercel.com](https://vercel.com) → your **decoftxportal** project.

2. **Environment Variables**  
   Go to **Settings** → **Environment Variables**.

3. **Remove old values (optional but recommended)**  
   If **DATABASE_URL** and **AUTH_SECRET** already exist, edit them (don’t add duplicates). We’ll set fresh values next.

4. **Set DATABASE_URL**  
   - Name: `DATABASE_URL`  
   - Value: the **full** Session Pooler URL you built in Part 1 (with your real password, no `[YOUR-PASSWORD]` left).  
   - Environments: check **Production** (and Preview if you use it).  
   - Save.

5. **Set AUTH_SECRET**  
   - Name: `AUTH_SECRET`  
   - Value: a **random secret**, not a sentence or instruction.  
     On your computer, run in a terminal:
     ```bash
     openssl rand -base64 32
     ```
     Copy the **output** (one line of random characters). Example:  
     `K7xR9mN2pQ4vL8wY1zA3bC5dE6fG0hJ=`
   - Paste that output as the value of **AUTH_SECRET** in Vercel.  
   - Environments: **Production** (and Preview if you use it).  
   - Save.

6. **Confirm**  
   You should have exactly:
   - `DATABASE_URL` = your Supabase **Session pooler** URL with password filled in.  
   - `AUTH_SECRET` = the output of `openssl rand -base64 32`.

---

## Part 3: Create tables and seed users (one-time)

The app needs tables and at least one user in the **same** database Vercel uses. You do this once from your own machine using the **same** DATABASE_URL you put in Vercel.

1. **Use the same URL as in Vercel**  
   Copy the **exact** `DATABASE_URL` value from Vercel (the Session Pooler URL).  
   If you don’t want to copy from Vercel, build it again in Supabase (Part 1) and use that.

2. **Open a terminal** in your project folder (where `package.json` is).

3. **Create tables**
   ```bash
   DATABASE_URL="paste_your_full_session_pooler_url_here" npm run db:push
   ```
   Replace `paste_your_full_session_pooler_url_here` with the real URL in quotes.  
   You should see something like: “Database is in sync” or “Tables created”.

4. **Create reception and doctor users (and sample data)**
   ```bash
   DATABASE_URL="paste_your_full_session_pooler_url_here" npx tsx prisma/seed.ts
   ```
   Use the **same** URL again.  
   You should see: “Reception user: reception@decoftexas.com”, “Doctor user: doctor@decoftexas.com”, “Seed done.”

5. **Optional: custom seed password**  
   Default password is `changeme`. To set another:
   ```bash
   DATABASE_URL="your_url" PORTAL_SEED_PASSWORD="YourChosenPassword" npx tsx prisma/seed.ts
   ```
   Then use `YourChosenPassword` to sign in.

---

## Part 4: Redeploy and test

1. **Redeploy on Vercel**  
   **Deployments** → open the latest deployment → **⋮** → **Redeploy**.  
   This makes Vercel use the new env vars.

2. **Wait for the deploy** to finish (green check).

3. **Open your app**  
   Use the Vercel URL (e.g. `https://your-project.vercel.app`).

4. **Sign in**  
   - Email: `reception@decoftexas.com`  
   - Password: `changeme` (or whatever you set in `PORTAL_SEED_PASSWORD`).

---

## If it still doesn’t work

- **“Invalid email or password”**  
  - Confirm you used the **Session pooler** URL in Vercel (not Direct), and that you ran **both** `db:push` and `seed` with that **same** URL.  
  - Confirm **AUTH_SECRET** is the `openssl rand -base64 32` output, not a sentence.

- **Connection / timeout errors**  
  - Double-check the URL: correct host, port **6543** for pooler, password correct and URL-encoded if it has `@` or `#`.

- **Rate limiting**  
  - After 5 failed sign-in attempts per email, wait 15 minutes or try the other user: `doctor@decoftexas.com` / same password.

- **Verify users exist**  
  In Supabase: **Table Editor** → **User** table. You should see rows for `reception@decoftexas.com` and `doctor@decoftexas.com`. If the table is empty, re-run the seed (Part 3) with the same DATABASE_URL you use in Vercel.
