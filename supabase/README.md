# Supabase

Everything the backend needs. Run in the SQL Editor (or `supabase db push`), in order. All files are safe to run again.

| File | What it creates | Needed |
|---|---|---|
| `migrations/0001_init.sql` | `exercises` (public catalog), `user_data` (plan, own exercises, settings), `workout_logs`, with Row Level Security | always |
| `migrations/0002_google_health.sql` | `health_connections`, `health_oauth_states`: secret tables reachable **only** by the Edge Functions | Fitbit integration |
| `migrations/0003_body_logs.sql` | `body_logs`: body-weight entries | body-weight sync |
| `seed.sql` | the exercise catalog as table rows (generated, optional) | no |

## Edge Functions (Fitbit integration only)

| Function | Deploy | Purpose |
|---|---|---|
| `functions/health` | `supabase functions deploy health` | all actions, requires the user's login |
| `functions/health-callback` | `supabase functions deploy health-callback --no-verify-jwt` | Google's redirect target |

Secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, optional `HEALTH_ALLOWED_EMAILS`. See [docs/GOOGLE-HEALTH.md](../docs/GOOGLE-HEALTH.md).

> Never put the `service_role` key in the app or in git. Edge Functions receive it from Supabase automatically.
