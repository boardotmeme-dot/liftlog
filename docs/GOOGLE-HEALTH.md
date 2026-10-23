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
| **Workout** tab | Last night's sleep and, on short nights, a gentle hint |
| **More** | Connect / disconnect |

Only a summary is stored, inside the workout record in **your** database: average, min, max and a 90-point chart. Raw heart-rate samples are never saved.

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
