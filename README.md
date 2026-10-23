# liftlog

An open-source workout tracker you can host yourself. Plan your training days, tick off sets with a rest timer, see your history and stats, and look up how to do any of **86 exercises** with step-by-step instructions and video references.

* Works offline as an installable PWA. Without any backend, your data stays in the browser.
* Optional accounts and multi-device sync through your own [Supabase](https://supabase.com) project (free tier is enough).
* Exercise catalog is plain JSON in this repo: anyone can add or correct an exercise with a pull request.
* English UI. MIT licensed.

## Run it locally (no backend)

```bash
git clone <this repo>
cd liftlog
npm install
npm run dev
```

Open the printed URL. That is a complete app; accounts are hidden until you configure Supabase.

## Turn on accounts and sync (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste and run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql` (the exercise catalog as a table; optional but handy for your own queries).
3. **Authentication → Sign In / Providers → Email**: keep Email enabled. For personal use you can switch off *Confirm email*; for a public instance leave it on and configure SMTP.
4. **Authentication → URL Configuration**: set *Site URL* to where you host the app (and add `http://localhost:5173` to redirect URLs for development).
5. Copy `.env.example` to `.env` and fill in **Project URL** and the **anon / publishable key** (Project Settings → API). Both are public by design; security comes from the row-level-security policies in the migration. **Never** put the `service_role` key in this app.
6. `npm run dev`. The *More* tab now shows sign in / sign up.

How sync works: finished workouts are separate rows with client-generated ids, so two devices can never overwrite each other's history. Your plan, custom exercises and settings are one row; the most recent edit wins.

## Deploy

Any static host works. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host's environment settings, build command `npm run build`, output `dist`.

* **Vercel**: import the repo, framework preset *Vite*, add the two env vars.
* **Netlify / Cloudflare Pages**: same settings.
* **GitHub Pages** (sub-path): build with `VITE_BASE=/your-repo/ npm run build` and publish `dist`.

## Project layout

```
catalog/exercises/*.json   one file per exercise (source of truth)
catalog/SCHEMA.md          format and rules, incl. rules for video references
scripts/catalog.mjs        validate | build | links
src/logic.ts               pure functions (plates, stats, merge) with tests
src/store.ts               local-first state, persisted to localStorage
src/cloud.ts               Supabase auth and sync
supabase/migrations        database schema and row-level security
```

`npm run catalog:build` generates `src/data/catalog.json` (bundled into the app) and `supabase/seed.sql`. `npm run catalog:links` checks every YouTube/TikTok reference still exists.

## About the video references

The app only **links** to videos on their original platform and shows the author. Nothing is copied or embedded. References were collected from search results and checked to exist, but form quality is a human judgement: if you see a bad one, please open an issue or a PR.

## Roadmap ideas

Pounds, per-set weights and reps, supersets, plan sharing, more languages, more exercises.

## License

MIT. Exercise descriptions in `catalog/` are written for this project and are under the same license; linked videos belong to their authors.
