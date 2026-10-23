# Fitbit / Pixel Watch integration (Google Health)

Optional. liftlog can read your **heart rate, calories, sleep, HRV, resting heart rate, steps and weight** from your Fitbit or Pixel Watch through the [Google Health API](https://developers.google.com/health/about), show them next to your training, warn you when your heart rate gets too high during a set, and (if you allow it) write your workouts and body weight back.

Everything runs through **your own** Google Cloud app and **your own** Supabase project. Nobody else, including the author of liftlog, receives your data.

> The old Fitbit Web API is switched off on 30 October 2026. This integration uses its replacement, the Google Health API (v4).

<p align="center">
  <img src="screenshots/health-live.jpg" width="230" alt="Live heart rate and rest recovery" />
  &nbsp;
  <img src="screenshots/health-today.jpg" width="230" alt="Today panel with recovery score" />
  &nbsp;
  <img src="screenshots/health-workout.jpg" width="230" alt="Heart-rate chart on a workout" />
</p>
<p align="center"><sub>Screenshots use invented demo data.</sub></p>

## Contents

1. [What you get](#1-what-you-get)
2. [How it works](#2-how-it-works)
3. [Setup](#3-setup)
4. [Using it](#4-using-it)
5. [Settings reference](#5-settings-reference)
6. [Sending data to Google Health (optional)](#6-sending-data-to-google-health-optional)
7. [Limits, publishing and who can use it](#7-limits-publishing-and-who-can-use-it)
8. [Privacy and security](#8-privacy-and-security)
9. [Troubleshooting](#9-troubleshooting)
10. [Reference: data, permissions, API](#10-reference-data-permissions-api)
11. [Developer tools](#11-developer-tools)

---

## 1. What you get

| Where in the app | What it shows |
|---|---|
| **Workout** tab, *Today* panel | **Recovery score** (0-100) with a one-line suggestion, last night's **sleep** (total, deep, REM), and an expandable grid: resting heart rate and HRV against your own 2-week norm, steps today with a 7-day mini chart, calories, distance, active zone minutes, breathing rate, latest weight |
| **During a workout** | Your **live heart rate** in the top bar, colour-coded by zone (easy / fat burn / cardio / hard / max), and while you rest a **recovering → recovered** indicator. An **alert** (banner, vibration, beep) when you reach your chosen share of max heart rate |
| **History** and the workout summary | Average, max and min heart rate of that workout, a **heart-rate chart**, and calories when your tracker recorded a session for the same time |
| **Stats** tab | Two-week trends of resting heart rate and HRV, the week's steps, and a **body-weight log** with trend |
| **More → Google Health** | Connect / disconnect, heart-rate alert settings, and the optional write-back switches |

### The recovery score

A simple, transparent guide, not medical advice. It is computed on your device from three numbers:

| Part | Points | How |
|---|---|---|
| Sleep | up to 40 | minutes asleep ÷ 480 (8 hours = full marks) |
| HRV | up to 30 | today's HRV vs the median of the previous days: ≥105% → 30, ≥95% → 22, ≥85% → 12, below → 4 |
| Resting heart rate | up to 30 | today vs the median of the previous days: 2+ bpm lower → 30, within ±2 → 22, up to 5 higher → 12, above → 4 |

Missing parts are left out and the rest is rescaled. **75+** *Ready to push*, **55-74** *Normal day*, **below 55** *Take it easy*.

### Live heart rate

While a workout is running and the app is open, liftlog asks for your latest heart-rate sample about **every 20 seconds**. Your tracker uploads to Google roughly once a minute, so the display is *near-live*, not instant. A reading older than **3 minutes** is shown as stale ("N min ago") and never triggers an alert. Alerts fire at most **once every 3 minutes**. The default max heart rate is 190 bpm (a common estimate is 220 minus your age) and the default alert level is 90% of it; both are editable.

## 2. How it works

```
┌──────────────┐   HTTPS + your login    ┌──────────────────────────────────────────┐
│ liftlog PWA  │ ──────────────────────▶ │ Supabase Edge Function  "health"          │
│ (your phone) │ ◀────────────────────── │  holds the Google client secret and the   │
└──────────────┘   small JSON summaries  │  refresh token; talks to Google           │
        │                                 └───────────────┬──────────────────────────┘
        │ Google consent page                              │ access token (cached ≤ 1 h)
        ▼ (once)                                           ▼
┌──────────────┐   code    ┌───────────────────────┐   ┌────────────────────────────┐
│ accounts.    │ ────────▶ │ Edge Function          │   │ health.googleapis.com/v4   │
│ google.com   │           │ "health-callback"      │   │ (Google Health API)        │
└──────────────┘           └───────────────────────┘   └────────────────────────────┘
```

* The **browser never sees a Google token.** It only talks to your Edge Function with your normal liftlog login.
* The Google **refresh token** is stored in the table `health_connections`. That table has Row Level Security on, **no policies**, and its grants are revoked for the `anon` and `authenticated` roles, so only the Edge Functions (service role) can read it.
* `health-callback` is the page Google sends you back to after you approve. It is protected by a one-time `state` value created for your signed-in user and deleted on use.
* What is saved with a workout is a **summary only** (average/min/max heart rate, a 90-point chart, calories). Raw samples are never stored.
* If the integration is not set up, the app behaves exactly as before and the feature is hidden.

## 3. Setup

You need liftlog already running with Supabase accounts (see [SETUP.md](SETUP.md)). Plan about **20 minutes**.

### 3.1 Prepare your phone account
Install the **Google Health** app and sign in with the Google account your tracker is linked to. (The API answers `ACCOUNT_NOT_LINKED` otherwise.)

### 3.2 Google Cloud

1. Open <https://console.cloud.google.com> and create a project, for example `liftlog-health`.
2. **APIs & Services → Library → Google Health API → Enable.**
3. **Google Auth Platform → Audience**: user type **External**, publishing status **Testing**. Under **Test users** add your own Google email.
4. **Data Access → Add or remove scopes.** Select these three **read-only** scopes and save:
   * `…/auth/googlehealth.activity_and_fitness.readonly`
   * `…/auth/googlehealth.health_metrics_and_measurements.readonly`
   * `…/auth/googlehealth.sleep.readonly`

   Only if you want to send workouts and weight back (section 6), also add `…activity_and_fitness.writeonly` and `…health_metrics_and_measurements.writeonly`.
5. **Clients → Create client → Web application.** Under *Authorized redirect URIs* add
   `https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/health-callback`
   (your *project ref* is the part before `.supabase.co` in your Supabase URL).
6. Copy the **Client ID** and **Client secret**.

> The client secret is a password. It goes only into Supabase secrets (step 3.4). Never put it in `.env`, in git, in an issue or in a chat.

Optionally, check your Google setup before going further with `bash scripts/google-health-check.sh <CLIENT_ID>` (section 11).

### 3.3 Supabase database
Run these files once in the **SQL Editor** (they are safe to run again):

| File | Needed for |
|---|---|
| [`supabase/migrations/0002_google_health.sql`](../supabase/migrations/0002_google_health.sql) | the connection itself: creates `health_connections` and `health_oauth_states`, reachable **only** by the Edge Functions |
| [`supabase/migrations/0003_body_logs.sql`](../supabase/migrations/0003_body_logs.sql) | syncing the body-weight log between devices (works without Google too) |

### 3.4 Supabase Edge Functions and secrets
With the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <YOUR-PROJECT-REF>
supabase functions deploy health
supabase functions deploy health-callback --no-verify-jwt
supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... APP_URL=https://your-site.vercel.app
```

`health-callback` must be deployed with `--no-verify-jwt`: Google's redirect carries no login header. You can also set the secrets in the dashboard under **Edge Functions → Secrets**.

| Secret | Required | Meaning |
|---|---|---|
| `GOOGLE_CLIENT_ID` | yes | from step 3.2.6 |
| `GOOGLE_CLIENT_SECRET` | yes | from step 3.2.6 |
| `APP_URL` | yes | your site's address, no trailing slash; where the callback sends you back |
| `HEALTH_ALLOWED_EMAILS` | no | comma separated emails. When set, only these accounts can use the integration on this server; removing an email disables an existing connection but still lets its owner disconnect (see section 7) |

### 3.5 Turn the feature on in the app
Add the variable `VITE_ENABLE_GOOGLE_HEALTH=true` in **Vercel → Settings → Environment Variables** (and in `.env` locally), then **redeploy**. The flag is baked in at build time.

### 3.6 Connect
Open the app, sign in, go to **More → Google Health (Fitbit) → Connect**. Read the short notice, then on Google's page choose your account. If Google says **"Google hasn't verified this app"**, tap **Advanced → Go to liftlog (unsafe)** (it is your own app), and allow the read-only permissions. You come back to liftlog with *Connected*.

## 4. Using it

* **Today panel**: open the **Workout** tab. Tap the panel to expand it. It refreshes at most every 20 minutes; tap *Refresh* for now.
* **A workout with heart rate**: start a workout, tick sets. Your heart rate appears in the top bar. When you **Finish**, the summary tries to fetch the workout's heart rate straight away. If it says the tracker has no data yet, open the **Google Health** app on your phone (that makes the tracker upload) and press **Add heart rate and calories** under the workout in **History**.
* **Why "no data yet"?** The message tells you which case you are in: *"Google only has tracker data up to 14:42, before this workout ended"* means the tracker has not synced; *"No heart-rate samples were recorded during this workout"* means there was data but none in that window (a very short workout, or the tracker was off your wrist).
* **Calories** come from the tracker's own exercise session that overlaps your workout (if you started one on the band). Without a session you still get heart rate.

## 5. Settings reference

**More → Google Health (Fitbit)**

| Setting | Default | Effect |
|---|---|---|
| Alerts | On | Warn when heart rate reaches the alert level during a workout |
| Max HR | 190 bpm | Used for zones, alerts and the "recovered" indicator (below 70% of max) |
| Alert at | 90% of max | Alert threshold |
| Workouts *(after "Allow writing")* | Only when I tap Send | Or **Automatically** |
| Body weight *(after "Allow writing")* | Keep in liftlog only | Or also send to Google Health |

**More → Rest timer** has *Vibration* and *Beep* (the alert uses both). Note that iPhones do not support web vibration; the beep and the banner still work.

## 6. Sending data to Google Health (optional)

Off by default. It needs extra permission that you grant explicitly.

**What is sent**

* **Workouts**: a finished workout becomes a *Strength training* session with your exercises, sets and weights in the notes (for example `Squat: 3×5 @ 100 kg`).
  * **No duplicates:** if your tracker already recorded a session that overlaps (at least 40% of the shorter of the two), nothing is sent and the workout is marked *"already recorded by your tracker"*.
  * **Automatic mode** waits **two hours** after a workout so the tracker has time to upload its own session, only looks at the last 7 days, and only sends workouts with at least one set.
  * **Manual mode**: *Send to Google Health* under the workout in **History**.
* **Body weight**: entries you log in **Stats → Body weight**.
* **Deleting** a workout or a weight entry in liftlog also removes the copy it created in Google Health (Google only lets an app delete what it added itself).

**How to turn it on**

1. Google Cloud → **Data Access**: add the two `writeonly` scopes (step 3.2.4) and save.
2. liftlog: **More → Google Health → Allow writing**, approve on Google's page.
3. Choose *Automatically* or *Only when I tap Send*, and whether weight is sent.

## 7. Limits, publishing and who can use it

* **Testing mode (default):** only the test users you list can connect, and tokens last **7 days**. When it expires the card says so; press **Reconnect**.
* **Publish for longer tokens:** in Google Auth Platform fill in **Branding** (app name, support email, a privacy-policy link such as this repo's [PRIVACY.md](PRIVACY.md), developer contact; add `github.com` as an authorized domain if you link to GitHub) and press **Audience → Publish app**. The app becomes *In production* but stays **unverified**: people see *"Google hasn't verified this app"* and the app is capped at **100 users**. Tokens then last much longer.
* **More than 100 users** needs Google's verification of restricted scopes: your own verified domain, a published privacy policy on it, a demo video, and a paid security assessment (CASA) by an approved assessor, renewed yearly. This is why liftlog is meant to be **self-hosted**: everyone runs their own Google app and database.
* **A shared demo.** If you let strangers try the integration on your server, their Google refresh tokens are stored in *your* Supabase project, so you are hosting their health data (up to the 100-user cap). The app shows each person a notice before connecting. If you would rather not, set the secret `HEALTH_ALLOWED_EMAILS` to your own address, and everyone else sees a message to host their own copy. On your own private copy, leave it empty.

## 8. Privacy and security

* **Read-only by default.** Writing is a separate permission.
* **Narrow scopes.** Only activity and fitness, health metrics and measurements, and sleep. No location, ECG, nutrition or reproductive-health scopes.
* **Tokens stay on the server.** The refresh token lives in `health_connections`, unreachable from the browser. Access tokens are cached in the function's memory for under an hour.
* **Disconnect** (More → Google Health) revokes the token at Google and deletes it from your database. You can also remove access at <https://myaccount.google.com/permissions>.
* **What stays in your database:** workout summaries (average/min/max heart rate, a 90-point chart, calories) inside your workout records, your body-weight log, and, if you enabled writing, a reference to the Google entries liftlog created.
* liftlog's use of Google data adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. More in [PRIVACY.md](PRIVACY.md) and [SECURITY.md](../SECURITY.md).

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| The Google Health card is missing | `VITE_ENABLE_GOOGLE_HEALTH=true` was not set at build time. Add it and redeploy. You must also be signed in to a liftlog account. |
| "Not set up on this server" | The three secrets are missing or the functions are not deployed (step 3.4). |
| "Limited to the owner of this server" | `HEALTH_ALLOWED_EMAILS` is set and your email is not in it. |
| `redirect_uri_mismatch` on Google's page | The redirect URI in step 3.2.5 must equal `https://<ref>.supabase.co/functions/v1/health-callback` exactly. |
| "Access blocked… only test users" | Your Google email is not under **Test users**, or you chose another account on Google's page. |
| "Google hasn't verified this app" | Expected for your own app: **Advanced → Go to liftlog (unsafe)**. |
| `ACCOUNT_NOT_LINKED` / the Today panel is empty | Sign in to the **Google Health** app with that Google account first. |
| "Google access expired. Connect again in More" | Test-mode tokens last 7 days. Press **Reconnect**, or publish the app (section 7). |
| "Google only has tracker data up to HH:MM" | The tracker has not synced. Open the Google Health app, wait a minute, try again. |
| Live heart rate shows "N min ago" | Same cause: the tracker is not syncing (Bluetooth off, Google Health app not running). |
| "Sending to Google Health is not enabled" | Do **Allow writing** in More and add the `writeonly` scopes in Google Cloud (section 6). |
| 403 from the function when connecting | You are not on the allow-list (see above) or secrets are missing. |
| SpO₂ or VO₂ max are empty | Not every tracker records them (the Fitbit Air does not); they are not shown. |

## 10. Reference: data, permissions, API

**Google data types liftlog reads** (all read-only):

| Data type | Used for | Method |
|---|---|---|
| `heart-rate` | live heart rate, workout summary | list (newest first) |
| `exercise` | calories and the "tracker already recorded this" check | list |
| `sleep` | last night's sleep | list |
| `daily-resting-heart-rate`, `daily-heart-rate-variability`, `daily-respiratory-rate` | recovery score, trends | list |
| `steps`, `total-calories`, `distance`, `active-zone-minutes` | the Today grid | dailyRollUp |
| `weight` | latest weight | list |

**Written only if you allow it:** `exercise` (create, batchDelete) and `weight` (create, batchDelete).

**Permissions (OAuth scopes)** all begin with `https://www.googleapis.com/auth/googlehealth.`: `activity_and_fitness.readonly`, `health_metrics_and_measurements.readonly`, `sleep.readonly`; and optionally `activity_and_fitness.writeonly`, `health_metrics_and_measurements.writeonly`. Google classes all of them as **restricted**.

**The `health` Edge Function** (POST, requires your liftlog login; body `{ "action": … }`):

| Action | Purpose |
|---|---|
| `status` | configured / allowed / connected / expiry / can write |
| `connect` (`write: true` to also ask for write access) | returns the Google consent URL |
| `disconnect` | revoke at Google and delete the token |
| `workout` (`startMs`, `endMs`) | heart-rate summary and matching tracker session for a time window |
| `live` | the newest heart-rate sample |
| `today` (`utcOffsetMin`) | daily summaries, trends, sleep |
| `sleep` | last night's sleep |
| `exportWorkout`, `exportWeight`, `deleteExport` | writing and removing (needs write access) |

## 11. Developer tools

* **Demo mode.** Build or run with `VITE_HEALTH_DEMO=true` and the whole integration appears with **invented** tracker data, with no Google account or backend needed. It is how the screenshots in this repository were made, and a quick way to look at the interface. It is compiled out of normal builds (`src/health-demo.ts`).
  ```bash
  VITE_HEALTH_DEMO=true npm run dev
  ```

* `bash scripts/google-health-check.sh <CLIENT_ID>`: checks that your Google setup works (asks for the client secret, hidden, prints no tokens) and lists which data types your device returns.
* `python3 scripts/google-health-probe.py <CLIENT_ID> [--shapes] [--write-test]`: prints the raw shape of each data type; `--write-test` creates and immediately deletes one tiny test workout and weight entry. Output is also saved to `scripts/.probe-output.txt` (git-ignored; it contains your health numbers, do not share it).
