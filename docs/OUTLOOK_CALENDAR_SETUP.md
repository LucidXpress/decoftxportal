# Outlook calendar integration – step-by-step

This guide walks through creating a Microsoft app registration so reception and doctors can connect their Outlook calendars. New appointments created in the dashboard are then added to the reception user’s calendar and the assigned doctor’s calendar (if they’ve connected).

---

## Where to start

You can use either:

- **Microsoft Entra (recommended):** https://entra.microsoft.com  
- **Azure Portal:** https://portal.azure.com → search for “App registrations” or “Microsoft Entra ID”

Both lead to the same app registration experience. The steps below use **Entra**; in Azure Portal the menu names are the same or very similar.

---

## Step 1: Sign in and open App registrations

1. Go to **https://entra.microsoft.com** and sign in with your Microsoft account (work or personal).
2. In the left sidebar, click **Applications** (or **Apps**).
3. Under it, click **App registrations**.
4. At the top, click **+ New registration**.

---

## Step 2: Register the app

1. **Name**  
   Enter a name for the app, e.g. **Decof Portal** or **Decof Texas Portal Calendar**.

2. **Supported account types**  
   Choose one:
   - **Accounts in any organizational directory and personal Microsoft accounts** – work/school and personal Outlook (most flexible).
   - **Accounts in this organizational directory only** – only your organization’s accounts (simplest if everyone uses the same org).

3. **Redirect URI**  
   Leave this section **empty** for now. You’ll add the redirect URI in the next step.

4. Click **Register**.

You’ll land on the app’s **Overview** page. Keep this tab open; you’ll need the **Application (client) ID** and **Directory (tenant) ID** from here later (we only use the client ID in the portal app).

---

## Step 3: Add the redirect URI

The redirect URI is where Microsoft sends the user after they sign in. It must match exactly what your app uses.

1. In the left sidebar, click **Authentication**.
2. Click **+ Add a platform**.
3. Choose **Web**.
4. Under **Redirect URIs** you’ll see a box. Add **one** of these first (you can add the other next):
   - **Production:**  
     `https://your-actual-domain.com/api/auth/microsoft/callback`  
     Replace `your-actual-domain.com` with your real domain (e.g. `decoftxportal.vercel.app` or your custom domain). No trailing slash.
   - **Local dev:**  
     `http://localhost:3000/api/auth/microsoft/callback`
5. Under **Implicit grant and hybrid flows**, leave both checkboxes **unchecked**.
6. Click **Configure** at the bottom.

To add a second URI (e.g. local + production): on the same **Authentication** page, under **Web** → **Redirect URIs**, click **Add URI**, paste the other URL, then click **Save** at the top.

---

## Step 4: Add API permissions

Your app needs permission to create events in the user’s calendar.

1. In the left sidebar, click **API permissions**.
2. Click **+ Add a permission**.
3. Click **Microsoft Graph**.
4. Choose **Delegated permissions** (user signs in; the app acts on their behalf).
5. In the search box, type **Calendars** and tick **Calendars.ReadWrite**.
6. Search for **User.Read** and tick it (often already selected).
7. Search for **offline_access** and tick it (so you get a refresh token).
8. Click **Add permissions** at the bottom.

You should see at least:

- Calendars.ReadWrite  
- User.Read  
- offline_access  

If your organization requires **admin consent**, you’ll see a note and a **Grant admin consent** button; an admin may need to click it. For many tenants these delegated permissions work without admin consent.

---

## Step 5: Create a client secret

The client secret is like a password for your app. You’ll put it in `.env.local` and in your host’s environment variables (e.g. Vercel).

1. In the left sidebar, click **Certificates & secrets**.
2. Under **Client secrets**, click **+ New client secret**.
3. **Description:** e.g. `Portal calendar` or `Decof Portal`.
4. **Expires:** e.g. **24 months** (you’ll need to create a new secret before it expires and update your env).
5. Click **Add**.
6. In the **Value** column you’ll see the secret. Click **Copy** (or the copy icon) and paste it somewhere safe **immediately**. You cannot see it again after you leave this page.

---

## Step 6: Copy the Application (client) ID

1. In the left sidebar, click **Overview**.
2. Under **Essential**, find **Application (client) ID**.
3. Click **Copy** (or the copy icon) and save it next to your client secret.

You now have:

- **Application (client) ID** (from Overview)  
- **Client secret value** (from Certificates & secrets)

---

## Step 7: Add them to your app

1. Open your project’s **`.env.local`** (create it from `.env.example` if needed).
2. Add or fill in:

```env
MICROSOFT_CLIENT_ID="paste-the-application-client-id-here"
MICROSOFT_CLIENT_SECRET="paste-the-client-secret-value-here"
APP_URL="https://your-domain.com"
```

- **APP_URL** must be the exact root URL of your app:
  - Production: `https://your-domain.com` (no trailing slash).
  - Local: `http://localhost:3000`
- Use the same domain in **APP_URL** as in the redirect URI you added in Step 3 (e.g. if the redirect URI is `https://myapp.vercel.app/api/auth/microsoft/callback`, then `APP_URL="https://myapp.vercel.app"`).

3. Save the file. Restart your dev server if it’s running.

For **production** (e.g. Vercel): add the same three variables in the project’s **Environment Variables** (Settings → Environment Variables). Use your production URL for `APP_URL` and ensure the same redirect URI is added in Azure/Entra for that URL.

---

## Step 8: Run the database migration

The app stores Outlook tokens in the `users` table. Add the columns once:

1. Open your **Supabase** project → **SQL Editor**.
2. Run the SQL from **`supabase/migrations/20250212000000_add_microsoft_calendar_tokens.sql`** (the three `ALTER TABLE users ADD COLUMN ...` lines).
3. Confirm the migration ran without errors.

---

## Step 9: Test the connection

1. Deploy or run your app (e.g. `npm run dev` for local).
2. Sign in as a **reception** or **doctor** user.
3. Go to **Settings**.
4. In the **Outlook calendar** section, click **Connect Outlook**.
5. You should be redirected to Microsoft to sign in. Sign in with the account whose calendar you want to use.
6. After consent, you should be redirected back to Settings with a message like “Outlook calendar connected.”

If you get an error:

- **Redirect URI mismatch:** The redirect URI in Entra must match exactly: `{APP_URL}/api/auth/microsoft/callback` (same protocol, domain, path, no trailing slash on APP_URL).
- **Not configured:** Check that `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` are set and that you restarted the server after changing `.env.local`.

---

## Quick checklist

- [ ] App registered in Entra (or Azure) with a name.
- [ ] **Authentication** → Web → Redirect URI added for your app URL (and localhost if needed).
- [ ] **API permissions** → Delegated: Calendars.ReadWrite, User.Read, offline_access.
- [ ] **Certificates & secrets** → Client secret created and value copied.
- [ ] **Overview** → Application (client) ID copied.
- [ ] `.env.local` (and production env) has MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, APP_URL.
- [ ] Migration `20250212000000_add_microsoft_calendar_tokens.sql` run in Supabase.
- [ ] Test: Settings → Connect Outlook → sign in with Microsoft → success.

---

## What happens after it’s set up

- **Reception** and **doctors** go to **Settings** and click **Connect Outlook** once per user.
- When **reception** creates a new appointment, the app creates a calendar event in:
  - The reception user’s Outlook calendar (whoever is logged in),
  - The assigned doctor’s Outlook calendar (if that doctor has connected Outlook).
- Events use the patient name and exam type as the title; notes and OneDrive link go in the body.
