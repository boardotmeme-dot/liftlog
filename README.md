<div align="center">

<img src="public/icon-192.png" width="96" height="96" alt="liftlog icon" />

# liftlog

**A private workout tracker you own.**<br />
Plan your training, log every set, learn every exercise, and keep your data in *your* database. Free, open source, installs on your iPhone like an app.

[![CI](https://github.com/boardotmeme-dot/liftlog/actions/workflows/ci.yml/badge.svg)](https://github.com/boardotmeme-dot/liftlog/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-black.svg)](LICENSE)
![PWA](https://img.shields.io/badge/PWA-offline%20ready-2F7D4F)
![Exercises](https://img.shields.io/badge/exercises-124-C0392B)

[**Try the demo**](https://liftlog-neon-iota.vercel.app) · [**Self-host in 15 minutes**](docs/SETUP.md) · [**Install on iPhone**](docs/INSTALL-ON-PHONE.md)

</div>

<p align="center">
  <img src="docs/screenshots/workout.jpg" width="250" alt="Workout screen with sets, weights and rest timer" />
  &nbsp;
  <img src="docs/screenshots/exercise.jpg" width="250" alt="Exercise page with setup, steps and cues" />
  &nbsp;
  <img src="docs/screenshots/stats.jpg" width="250" alt="Stats: weekly goal, push/pull balance, sets per muscle" />
</p>

---

> **Project status:** liftlog is early-stage software (v0.1). Keep a recent JSON backup; features and the data format may change before 1.0.

## Why liftlog

Most workout apps want an account on *their* server, a subscription, and your data. liftlog is the opposite:

* **You own the data.** Deploy your own copy and connect your own free [Supabase](https://supabase.com) database. Nobody else, including the author of this project, can see your training. [How privacy works →](docs/PRIVACY.md)
* **Works without any server.** Skip the database and everything stays in your browser. Add it later when you want sync between devices.
* **Feels like a real app.** Install it from Safari to your Home Screen, use it offline in the gym, with a rest timer and the screen kept awake.
* **Teaches you the lifts.** 124 exercises, each with setup, steps, cues, common mistakes and hand-picked video references with previews.
* **No lock-in, no tracking, no ads.** MIT licensed. Export everything as JSON any time.

## Features

| | |
|---|---|
| **Training** | Multi-day plans, per-set weight and reps (hold a set to edit), rest timer that adapts to compound vs isolation lifts, warm-up ramp for barbell lifts, plate calculator, timed sets for planks and holds |
| **Library** | 124 exercises for the gym **and for home** (bodyweight, dumbbells, kettlebell, band), search and filters, **Top lists** such as *Top 10 with no equipment* and *The big compound lifts*, one tap to turn a list into a workout day |
| **Your own exercises** | Create exercises with steps, cues and **video links**: paste a YouTube link and the title, author and preview are filled in automatically |
| **Starter plans** | Full body 3 days, upper/lower 4 days, full body 4 days, home with no equipment, home with dumbbells |
| **Progress** | Personal records and estimated 1RM, weight charts, weekly goal and streak, push/pull and quad/posterior balance, sets per muscle per week, days since each muscle was trained, plateau detection |
| **Sync** | Optional accounts with your own Supabase project. Workouts are separate records, so two phones never overwrite each other's history |
| **Units** | Kilograms or pounds (US plates and 45 lb bar built in). Data is stored in kg, so you can switch freely |
| **Fitbit / Pixel Watch** *(optional)* | Heart rate, calories and last night's sleep from the Google Health API, read-only, through your own Supabase. [Set it up →](docs/GOOGLE-HEALTH.md) |
| **Offline** | Installable PWA, works without a connection, syncs when you are back online |

## Get started

### 1. Just look around (30 seconds)

Open the [**live demo**](https://liftlog-neon-iota.vercel.app). Without signing in, everything is saved only in your browser.

> The demo is a shared playground run by the project author. Do not rely on it for long-term data; host your own copy for that.

### 2. Run it on your computer

```bash
git clone https://github.com/boardotmeme-dot/liftlog.git
cd liftlog
npm install
npm run dev
```

Needs [Node.js 20+](https://nodejs.org). That is a complete app running at the printed address, no accounts needed.

To verify the checkout before making changes:

```bash
npm test
npm run build
```

### 3. Your own private copy online, with sync (recommended)

You need two free accounts: **Supabase** (the database) and **Vercel** (the hosting). The full, click-by-click guide is in **[docs/SETUP.md](docs/SETUP.md)**. In short:

1. Create a Supabase project and run one SQL file from this repo.
2. Deploy to Vercel and paste two values (your project URL and public key).
3. Open your site on your iPhone and **Add to Home Screen**.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fboardotmeme-dot%2Fliftlog&env=VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY&envDescription=Your%20Supabase%20project%20URL%20and%20public%20(anon%2Fpublishable)%20key&envLink=https%3A%2F%2Fgithub.com%2Fboardotmeme-dot%2Fliftlog%2Fblob%2Fmain%2Fdocs%2FSETUP.md%233-connect-the-app-to-supabase&project-name=liftlog&repository-name=liftlog)

Create the Supabase project and run the SQL **before** you press the button, then you will have the two values ready. [Step by step →](docs/SETUP.md)

## Install on your phone

| iPhone / iPad | Android | Desktop |
|---|---|---|
| Safari → **Share** → **Add to Home Screen** | Chrome → **⋮** → **Install app** | Chrome / Edge → install icon in the address bar |

Details, tips and troubleshooting: **[docs/INSTALL-ON-PHONE.md](docs/INSTALL-ON-PHONE.md)**.

## How your data is protected

* Your database lives in **your** Supabase project; the app talks to it directly from your browser. There is no liftlog server in between.
* Every table has **Row Level Security**: the database itself only returns rows belonging to the signed-in user.
* The only keys in the app are the public ones (project URL and anon/publishable key), which are designed to be public. The secret `service_role` key is never used and must never be added.
* Third-party requests are limited to YouTube (thumbnails and, only after you tap play, the privacy-enhanced player). Fonts are bundled, there are no analytics or trackers.

Read the details in **[docs/PRIVACY.md](docs/PRIVACY.md)** and **[SECURITY.md](SECURITY.md)**.

## Support and bug reports

Found a bug or have a feature idea? Search the [existing issues](https://github.com/boardotmeme-dot/liftlog/issues), then [open an issue](https://github.com/boardotmeme-dot/liftlog/issues/new/choose). Please report security vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Contributing

Adding an exercise is as easy as adding one JSON file, and the CI checks it for you. Fixing a dead video link is a great first pull request.

* [CONTRIBUTING.md](CONTRIBUTING.md) — how to add exercises, collections and code
* [catalog/SCHEMA.md](catalog/SCHEMA.md) — exercise format and the rules for video references
* [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — how we treat each other
* [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the app is built

## Tech

Preact, TypeScript and Vite as a PWA. Supabase (Postgres, Auth, Row Level Security) for optional accounts and sync. Vitest for tests. There is no component library or analytics SDK; Inter and Oswald are bundled locally through Fontsource.

## Roadmap

Supersets, importing from other apps, sharing a plan by link, more languages, more exercises, a nicer chart for each lift. Ideas and pull requests welcome.

## Credits and licence

Code and exercise descriptions: [MIT](LICENSE). Linked videos belong to their authors; liftlog only shows their public preview and links to the original. If you are an author and would like a link removed, open an issue and it will be taken out.

Medical note: liftlog is a logbook and a learning aid, not medical advice. Start light, use good form, and talk to a professional if you have an injury or health condition.
