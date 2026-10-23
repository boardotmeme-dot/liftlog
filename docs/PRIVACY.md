# Privacy

**Short version:** when you host liftlog yourself, your training data goes from your browser to **your own** database and nowhere else. The people who wrote liftlog never receive it, and there is no liftlog server, analytics or advertising.

## Where your data is stored

| Mode | Where the data is | Who can read it |
|---|---|---|
| **No account** (default) | In your browser on this device (`localStorage`) | Only you, on this device |
| **Signed in**, your own Supabase project | On this device **and** in the Postgres database of the Supabase project **you** created | You, and whoever you give access to that Supabase project (normally nobody) |
| **Signed in on the public demo** | On this device and in the demo owner's database | The demo owner can technically read demo rows. Treat the demo as a sandbox. |

If you deploy your own copy, the "demo owner" is you.

## What is stored

* **Account:** your email and a password hash, managed by Supabase Auth (the plain password is never stored).
* **`user_data`:** your plan, your own exercises (including the video links you add) and your settings.
* **`workout_logs`:** every finished workout: date, duration, exercises, and each set's weight and reps.

No location, contacts, photos, device identifiers or health-platform data are collected.

## How other users are kept out

The database enforces access, not just the app. Every table has **Row Level Security** with policies such as:

```sql
create policy "own logs select" on public.workout_logs
  for select to authenticated using ((select auth.uid()) = user_id);
```

A signed-in user can only read and write rows whose `user_id` is their own. A request without a sign-in gets nothing. You can read all policies in [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).

The app only contains the **public** project URL and the **anon/publishable** key. These are meant to be visible in a web app; security comes from the policies above. The powerful `service_role` key is never used and must never be added to the app or to its environment variables.

## Optional Google Health integration

If you enable it ([GOOGLE-HEALTH.md](GOOGLE-HEALTH.md)):

* liftlog asks Google for **read-only** access to your activity, heart-rate and sleep data, from **your own** Google Cloud project.
* The OAuth refresh token is stored in `health_connections` in **your** Supabase project. That table has no Row Level Security policies and its grants are revoked for client roles, so only the Edge Functions can read it. The browser never receives a Google token.
* What is kept on a workout is a summary only (average/min/max heart rate, a 90-point chart, calories). Raw samples are not stored.
* **Disconnect** revokes the token at Google and deletes it from your database. Access can also be removed at <https://myaccount.google.com/permissions>.

## Requests to other services

The app is a static site. These are the only third-party requests it makes:

| When | To | What is sent |
|---|---|---|
| Showing a video preview in the library | `i.ytimg.com` (YouTube thumbnails) | Your IP address and browser details, as for any image |
| You tap **play** on a video | `youtube-nocookie.com` (privacy-enhanced player) | Normal player requests. Nothing loads before you tap |
| You paste a YouTube or TikTok link when creating an exercise | `youtube.com/oembed`, `tiktok.com/oembed` | The link you pasted, to get its title and preview |
| You are signed in | your Supabase project | Your data, as described above |
| Google Health enabled and used | your Supabase Edge Function, which calls `health.googleapis.com` | Your time range; heart-rate, exercise and sleep data come back |

Fonts are bundled with the app, so no font service is contacted. There are no analytics, trackers, cookies for advertising, or third-party scripts. If you want zero third-party requests, do not open the library's videos and do not add links.

## Deleting your data

* **From the device:** **More → Reset → Erase everything**. When you are signed in this also marks your workouts as deleted in the cloud.
* **Completely:** in Supabase, **Authentication → Users → delete the user**. Because the tables use `on delete cascade`, this removes `user_data` and every `workout_logs` row of that user.
* Deleting the Supabase project removes everything.

## Exporting your data

**More → Backup → Save backup** gives you a single JSON file with everything. It is an open format, readable by any tool.

## Using the public demo

The demo is shared and run by the project author. Do not put anything sensitive in it, and please host your own copy for real use ([SETUP.md](SETUP.md)).
