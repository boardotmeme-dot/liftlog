# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private reporting: **Security → Report a vulnerability** on this repository. Include what you found, how to reproduce it, and the impact. You will get a reply within a few days.

## Scope and design

* liftlog is a static web app. All access control is enforced by the database with **Row Level Security** (see [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)). A policy mistake is a security bug, please report it.
* The app only uses the public project URL and the anon/publishable key. **The `service_role` / secret key must never be placed in this app, its `.env` files or Vercel environment variables.** If you ever committed one, rotate it in the Supabase dashboard immediately.
* The catalog references third-party videos by link only. Reports of unsafe or malicious links are welcome and are treated as security issues.

## For people hosting their own copy

* Keep **Row Level Security enabled** on every table you add.
* Prefer a long, unique password; turn on leaked-password protection if your plan allows it.
* Do not paste secrets into issues or pull requests. Your `.env` is git-ignored; keep it that way.
