# Google Health (Fitbit) integration — optional

Show your **heart rate and calories** on every workout and **last night's sleep** on the workout screen, read from your Fitbit / Pixel Watch through the [Google Health API](https://developers.google.com/health/about).

* Read-only. liftlog never writes to Google Health.
* Works with your own Google Cloud project and your own Supabase project. Nobody else has access to your health data.
* Optional: without these steps the app works exactly as before and the feature is hidden.

> The old Fitbit Web API is switched off on 30 October 2026. This integration uses its replacement, the Google Health API.

## What you get

| Where | What |
|---|---|
| **History** and the **workout summary** | Average / max heart rate, a heart-rate chart, calories (from the tracker's matching exercise session) |
| **Workout** tab | A *Today* panel: recovery score, last night's sleep, resting heart rate, HRV, steps, calories, distance, active zone minutes, breathing rate, weight |
| **During a workout** | Your live heart rate at the top (colour-coded zones), a recovery indicator while you rest, and an alert when you reach a chosen share of your max heart rate |
| **Stats** tab | Two-week trends of resting heart rate and HRV, and the week's steps |
| **More** | Connect / disconnect |

Only a summary is stored, inside the workout record in **your** database: average, min, max and a 90-point chart. Raw heart-rate samples are never saved.

### The recovery score

A simple, transparent guide, not medical advice. 40 points from last night's sleep (8 hours = full), 30 from today's HRV and 30 from today's resting heart rate, each compared with your own two-week median. Missing parts are left out and the rest rescaled. 75+ "Ready to push", 55-74 "Normal day", below 55 "Take it easy".

### Live heart rate

While a workout is running and the app is open, liftlog asks for your latest heart-rate sample every ~20 seconds. Your tracker syncs to Google about once a minute, so the display is near-live, not instant. Readings older than 3 minutes are shown as stale and never trigger alerts. Set your max heart rate (common estimate: 220 minus age) and the alert level in **More → Google Health**.

## Sending data to Google Health (optional, off by default)

liftlog can also **write** to Google Health. Both are read-only until you allow it:

* **Workouts**: a finished workout is sent as a *strength training* session with your exercises, sets and weights in the notes. Nothing is sent if your tracker already recorded a session for that time, so you never get duplicates. Automatic sending waits two hours after a workout so the tracker has time to upload its own session.
* **Body weight**: weight entries you log in **Stats → Body weight** can be sent too.
* Deleting a workout or a weight entry in liftlog also removes the copy it created in Google Health (Google only lets an app delete what it added itself).

To turn it on:

1. In Google Cloud → **Data Access** add the two scopes `googlehealth.activity_and_fitness.writeonly` and `googlehealth.health_metrics_and_measurements.writeonly` and save.
2. In the app: **More → Google Health → Allow writing**, then approve on Google's page.
3. Choose *Automatically* or *Only when I tap Send* for workouts, and whether weight is sent.

The body-weight log itself works without Google. To sync it between devices run [`supabase/migrations/0003_body_logs.sql`](../supabase/migrations/0003_body_logs.sql) once.

## How it works

```
Your browser ──▶ Supabase Edge Function "health" ──▶ Google Health API
                      │  (holds your Google client secret and refresh token)
                      └─ table health_connections: no policies, no client access
```

The browser never sees a Google token. The refresh token lives in a table that only the Edge Functions (service role) can read.

## Setup (about 20 minutes)

You need liftlog already running with Supabase accounts ([SETUP.md](SETUP.md)).

### 1. Prepare your phone account
Install the **Google Health** app and sign in with the Google account your tracker is linked to.

### 2. Google Cloud
1. <https://console.cloud.google.com> → create a project (for example `liftlog-health`).
2. **APIs & Services → Library** → **Google Health API** → **Enable**.
3. **Google Auth Platform → Audience**: user type **External**, publishing status **Testing**. Add your own Google email under **Test users**.
4. **Data Access → Add or remove scopes**, select exactly these three **read-only** scopes and save:
   * `googlehealth.activity_and_fitness.readonly`
   * `googlehealth.health_metrics_and_measurements.readonly`
   * `googlehealth.sleep.readonly`
5. **Clients → Create client → Web application**. Under *Authorized redirect URIs* add:
   `https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/health-callback`
6. Copy the **Client ID** and **Client secret**.

> The client secret is a password. It goes only into Supabase secrets (step 4). Never put it in `.env`, in git, in an issue or in a chat.

### 3. Supabase database
Run [`supabase/migrations/0002_google_health.sql`](../supabase/migrations/0002_google_health.sql) once in the SQL Editor. It creates two tables that **nobody but the Edge Functions can access**.

### 4. Supabase functions and secrets
With the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <YOUR-PROJECT-REF>
supabase functions deploy health
supabase functions deploy health-callback --no-verify-jwt
supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... APP_URL=https://your-site.vercel.app
```

(`health-callback` must be deployed with `--no-verify-jwt`: it is opened by Google's redirect, which has no login header. It is protected by a one-time `state` value.)

You can also set the three secrets in the dashboard: **Edge Functions → Secrets**.

### 5. Turn the feature on in the app
Add an environment variable `VITE_ENABLE_GOOGLE_HEALTH=true` in Vercel (and in `.env` locally) and **redeploy**.

### 6. Connect
Open the app → **More → Google Health (Fitbit) → Connect**. Google shows a warning that the app is not verified (it is your own): **Advanced → Continue**, then allow the three read-only permissions.

## Publishing the Google app (and who can use it)

While the Google Auth Platform app is in **Testing** only your listed test users can connect, and tokens last **7 days**. For personal use, publish it: **Branding** (app name, support email, a privacy-policy link such as this repo's [PRIVACY.md](PRIVACY.md), developer contact) then **Audience → Publish app**. It becomes *In production* but stays **unverified**: Google shows an "unverified app" screen (Advanced → Continue) and caps it at **100 users**. Tokens then last much longer, so you stop reconnecting every week. Because every Google Health scope is *restricted*, serving more than 100 users needs a third-party security review by Google.

That is why liftlog is built to be **self-hosted**: everyone creates their own Google Cloud app and Supabase project, so nobody has to trust a shared server with health data.

If you run a shared demo, set the optional secret `HEALTH_ALLOWED_EMAILS` (comma separated, for example your own address) so strangers cannot connect their trackers and leave their tokens in your database. Leave it empty on your own private copy.

## Limits to know

* **Test mode tokens last 7 days.** While the Google app's status is *Testing*, the connection expires after a week; open **More** and press **Reconnect**. Publishing the app to *In production* (Audience page) avoids this. It stays unverified, with a cap of 100 users, which is plenty for personal use.
* The tracker syncs to Google a little after a workout. If **Add heart rate and calories** says there is no data yet, open the Google Health app to sync and try again.
* Calories come from the tracker's exercise session that overlaps your workout (if you started one on the band). Without a session you still get heart rate.
* Data types and field names come from Google's v4 API, which is new. If something stops working after an API change, please open an issue.

## Privacy

* Scopes are read-only and limited to activity, heart-rate and sleep.
* You can disconnect any time (**More → Disconnect**): the token is revoked at Google and deleted from your database. You can also remove access at <https://myaccount.google.com/permissions>.
* See [PRIVACY.md](PRIVACY.md).

## Troubleshooting

| Problem | Fix |
|---|---|
| The Google Health card is missing | `VITE_ENABLE_GOOGLE_HEALTH=true` was not set at build time. Add it and redeploy. |
| "Not set up on this server" | The three secrets are missing or the functions are not deployed. |
| `redirect_uri_mismatch` on Google's page | The redirect URI in step 2.5 must equal `https://<ref>.supabase.co/functions/v1/health-callback` exactly. |
| "Access blocked" | Your Google email is not in **Test users**, or you signed in with another account. |
| `ACCOUNT_NOT_LINKED` | Sign in to the Google Health app with that account first. |
| "Google access expired" | Test-mode tokens last 7 days. Reconnect in **More**. |
| Heart rate says no data | Sync the tracker (open Google Health), then try again. |

## Developer tools

* `bash scripts/google-health-check.sh <CLIENT_ID>` checks that your Google setup works (it asks for the secret, hidden, and prints no tokens).
* `python3 scripts/google-health-probe.py <CLIENT_ID>` shows which data types your device returns.
