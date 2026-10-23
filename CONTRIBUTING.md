# Contributing to liftlog

Thanks for helping! The easiest contributions need no coding at all.

## Add or fix an exercise

1. Copy a file in `catalog/exercises/` and rename it to your slug (`kebab-case.json`).
2. Follow [`catalog/SCHEMA.md`](catalog/SCHEMA.md). Everything is in English.
3. **Videos:** link only, never re-host. Open each link and **watch it**: the technique must be sound. Prefer coaches and physiotherapists. Give a second video from a different author when you can.
4. Check your work:
   ```bash
   npm install
   npm run catalog:validate
   npm run catalog:links      # confirms every YouTube/TikTok link exists
   ```
5. Open a pull request. CI repeats the checks.

Dead links are reported by a weekly CI run. Fixing one is a great first pull request.

## Add a top list

Create `catalog/collections/<id>.json` (format at the bottom of the schema doc). Every exercise needs a one-line reason.

## Code

```bash
npm install
npm run dev          # builds the catalog, starts Vite
npm test
npm run typecheck
```

* UI is Preact + TypeScript. Keep dependencies minimal.
* Put logic in `src/logic.ts` (pure, tested) rather than in components.
* Weights are stored in kg; use `src/units.ts` to display or read them.
* Never add secrets. Only the public Supabase URL and anon key belong in this project; see [SECURITY.md](SECURITY.md).

By contributing you agree your work is released under the [MIT licence](LICENSE).
