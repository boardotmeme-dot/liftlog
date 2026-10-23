# Changelog

## Unreleased

- README and docs describe the Fitbit / Google Health integration end to end, with screenshots
- Demo mode for the integration (`VITE_HEALTH_DEMO=true`, invented data) for screenshots and trying the UI

## 0.2.0, 2026-10-23

**Fitbit / Pixel Watch integration (optional)**
- Google Health API connection through your own Supabase Edge Functions; tokens never reach the browser
- Live heart rate while training with zones, a recovery indicator between sets and alerts at a chosen share of max heart rate
- *Today* panel: recovery score, sleep (deep/REM), resting heart rate, HRV, steps, calories, distance, active zone minutes, breathing rate, weight
- Average/min/max heart rate, chart and calories attached to each workout; two-week resting heart rate and HRV trends
- Opt-in write-back: finished workouts and body weight to Google Health, never duplicating tracker sessions; deleting in liftlog removes the copy
- Optional allow-list (`HEALTH_ALLOWED_EMAILS`) for shared demos

**App**
- Body-weight log with trend, synced between devices
- Finish or cancel a workout from the top bar on any day; jump to the running day
- Pounds support, exercise swap, custom exercises with video links and automatic previews
- Weekly sets per muscle (the 10-20 guide now compares weekly averages)
- Fixes: forgotten workouts are cut at the last activity, first-login plan conflict prompt, sync of more than 1000 logs, timed sets (planks) shown in seconds

**Project**
- Complete documentation for self-hosting, the phone install, privacy and the integration
- Code of conduct, issue and pull-request templates, weekly dead-link checks

## 0.1.0, 2026-10-23

First public release: 124 exercises with video references, top lists, starter plans, per-set logging, records, streaks, stats, optional accounts and sync with your own Supabase, installable PWA.
