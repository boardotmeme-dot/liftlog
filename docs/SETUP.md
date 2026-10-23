# Set up your own liftlog

This guide takes you from nothing to **your own private workout app on your iPhone**, with your data in **your own database**. It takes about 15 minutes and costs nothing.

**What you will end up with**

```
Your phone ──▶ your site on Vercel (the app) ──▶ your Supabase project (your data)
```

Nobody else has access to your Supabase project, so nobody else can see your training.

## Contents

1. [What you need](#1-what-you-need)
2. [Create the database (Supabase)](#2-create-the-database-supabase)
3. [Connect the app to Supabase](#3-connect-the-app-to-supabase)
4. [Run it locally (optional)](#4-run-it-locally-optional)
5. [Publish it (Vercel)](#5-publish-it-vercel)
6. [Tell Supabase where your site lives](#6-tell-supabase-where-your-site-lives)
7. [Put it on your phone](#7-put-it-on-your-phone)
8. [Keeping it up to date](#8-keeping-it-up-to-date)
9. [Backups and moving to another database](#9-backups-and-moving-to-another-database)
10. [Troubleshooting](#10-troubleshooting)
11. [Free tier limits worth knowing](#11-free-tier-limits-worth-knowing)

---

## 1. What you need

| | |
|---|---|
| A **GitHub** account | to keep your copy of the code (free) |
| A **Supabase** account | the database and sign-in (free): <https://supabase.com> |
| A **Vercel** account | hosting for the app (free "Hobby" plan): <https://vercel.com> |
| **Node.js 20+** | only if you want to run it on your computer: <https://nodejs.org> |

Tip: sign up to Vercel with your GitHub account, it makes step 5 a few clicks.

## 2. Create the database (Supabase)

1. In Supabase click **New project**. Pick any name (for example `liftlog`), choose the region closest to you, and set a database password. Save the password in a password manager; you will rarely need it.
2. Wait a minute until the project is ready.
3. Open **SQL Editor** → **New query**.
4. Open the file [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) from this repo, copy **all** of it, paste it into the editor, and press **Run**. You should see *Success. No rows returned*. Then do the same with [`0003_body_logs.sql`](../supabase/migrations/0003_body_logs.sql) (the body-weight log). Skip `0002_google_health.sql` unless you want the [Fitbit integration](GOOGLE-HEALTH.md).

   This creates three tables and the security rules (Row Level Security) that make every user see only their own rows:

   | Table | What it holds |
   |---|---|
   | `user_data` | your plan, your own exercises and your settings (one row per user) |
   | `workout_logs` | one row per finished workout |
   | `exercises` | optional copy of the exercise catalog for your own queries |
   | `body_logs` | your body-weight entries (from `0003`) |

5. *(Optional)* Also run [`supabase/seed.sql`](../supabase/seed.sql) in a new query to fill the `exercises` table. The app does not need it, it ships with its own copy of the catalog.
6. **Sign-in settings.** Go to **Authentication → Sign In / Providers → Email**:
   * Keep **Email** enabled.
   * **Confirm email**: for a *personal* app you can switch this **off**, so you can sign up without waiting for an email. If you switch it on, you must confirm via the link before the first sign-in (Supabase's built-in mail sender is limited to a few emails per hour; for a public instance configure your own SMTP).
7. *(Recommended)* In **Authentication → Attack Protection** switch on **Prevent use of leaked passwords** if your plan offers it.

## 3. Connect the app to Supabase

You need two values from **Project Settings → API** (called *Data API / API Keys* in newer dashboards):

| Value | Looks like | Notes |
|---|---|---|
| **Project URL** | `https://abcdefghijkl.supabase.co` | public |
| **Publishable key** (or **anon** key) | `sb_publishable_…` or a long `eyJ…` string | public by design |

> ⚠️ **Never copy the `service_role` or secret key into liftlog, Vercel or git.** It bypasses all security rules, and if it ends up in a website, anyone can read and delete everything in your database. Only the two public values above go into the app. The optional Edge Functions receive their server-side key automatically from Supabase.

These values are passed to the app through two environment variables:

```
VITE_SUPABASE_URL=https://abcdefghijkl.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxx
```

## 4. Run it locally (optional)

Skip this if you want to go straight to the web.

```bash
git clone https://github.com/boardotmeme-dot/liftlog.git
cd liftlog
cp .env.example .env        # then paste your two values into .env
npm install
npm run dev
```

Open the printed address, go to **More → Account → Create account**, and sign up. Finish a workout and check **Table Editor → workout_logs** in Supabase: your row is there.

`.env` is ignored by git, so your values are not committed by accident.

## 5. Publish it (Vercel)

### Option A: the button (fastest)

1. Click **Deploy with Vercel** in the [README](../README.md#3-your-own-private-copy-online-with-sync-recommended).
2. Vercel copies the project into **your** GitHub account and asks for the two environment variables from step 3. Paste them.
3. Press **Deploy**. After about a minute you get an address like `https://liftlog-yourname.vercel.app`.

### Option B: fork and import

1. On GitHub press **Fork** on this repository.
2. In Vercel: **Add New… → Project**, pick your fork, framework **Vite** is detected automatically.
3. Under **Environment Variables** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. **Deploy.** Every time you push to your fork, Vercel redeploys automatically.

### Option C: command line

```bash
npm install -g vercel
vercel login
vercel link                         # create a new project
printf 'https://abc.supabase.co' | vercel env add VITE_SUPABASE_URL production
printf 'sb_publishable_xxx'      | vercel env add VITE_SUPABASE_ANON_KEY production
vercel deploy --prod
```

> The two variables start with `VITE_` because they are baked into the app at build time. If you change them later, **redeploy** so the new values are used.

### Your own address (optional)

Vercel → your project → **Settings → Domains** lets you attach a domain you own.

## 6. Tell Supabase where your site lives

This makes password-reset emails and email-confirmation links open your site.

1. Supabase → **Authentication → URL Configuration**.
2. **Site URL**: your Vercel address, for example `https://liftlog-yourname.vercel.app`.
3. **Redirect URLs**: add the same address, and `http://localhost:5173` if you run it locally.
4. Save.

Plain sign-in works without this step; it matters for *Forgot password* and for confirmation emails.

## 7. Put it on your phone

Open your Vercel address in **Safari** on your iPhone → **Share** → **Add to Home Screen**. Then open liftlog from the Home Screen and **sign in inside that app**.

Full walkthrough with tips: **[INSTALL-ON-PHONE.md](INSTALL-ON-PHONE.md)**.

## 8. Keeping it up to date

If you used the **button** or a **fork**, add the original project as a second source once:

```bash
git remote add upstream https://github.com/boardotmeme-dot/liftlog.git
```

Whenever you want the latest features and new exercises:

```bash
git fetch upstream
git merge upstream/main
git push
```

Vercel redeploys on push. Database changes, if any, are listed in the release notes as new files in `supabase/migrations/`; run each new file once in the SQL Editor.

On GitHub you can also use **Sync fork** on your fork's page.

## Optional: Fitbit / Pixel Watch

Want live heart rate, a recovery score, sleep and trends next to your training? Follow [GOOGLE-HEALTH.md](GOOGLE-HEALTH.md) after the basic setup works.

## 9. Backups and moving to another database

* **In the app:** **More → Backup → Save backup** downloads one JSON file with your plan, exercises, settings and every workout. **Restore** loads it again, also into a brand-new database.
* **In Supabase:** *Database → Backups* (plan dependent), or export a table from the Table Editor as CSV.
* **Moving:** create a new Supabase project, run the SQL again, change the two environment variables on Vercel, redeploy, sign up, and restore your JSON backup.

## 10. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| **More** shows "Cloud sync is not configured" | The two `VITE_…` variables are missing in the build. Add them in Vercel → Settings → Environment Variables, then **redeploy**. |
| "Invalid API key" or every request fails | You pasted the wrong key or added a space. Copy the **publishable/anon** key again. |
| Sign-up says "Check your email" but nothing arrives | **Confirm email** is on. Either switch it off (step 2.6) or configure SMTP. |
| "Forgot password" link opens the wrong site | Set **Site URL** and **Redirect URLs** (step 6). |
| After sign-in nothing syncs, console shows `permission denied` or `relation does not exist` | The SQL from step 2.4 was not run (or failed). Run it again, it is safe to repeat. |
| Installed iPhone app asks me to sign in again | Normal the first time: the Home Screen app has its own storage. Sign in once inside it. |
| App does not update after a deploy | Close it fully and open it again; the service worker updates in the background and swaps on the next launch. |
| Site stopped working after weeks of not using it | Free Supabase projects pause when inactive. Open the Supabase dashboard and press **Restore project**; your data is kept. |
| Build fails on Vercel with a catalog error | Run `npm run catalog:validate` locally to see which exercise file is invalid. |

## 11. Free tier limits worth knowing

* **Supabase free:** a project is **paused after a period of inactivity** (about a week at the time of writing) and you restore it with one click. The data stays. Opening the app regularly, or a weekly check, avoids it. A paid plan removes pausing.
* **Vercel Hobby:** for personal, non-commercial use. A private workout log is well within it.
* A year of training is a few megabytes of data. You will not hit storage limits.
