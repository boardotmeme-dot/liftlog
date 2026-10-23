# Contributing

## Add or fix an exercise
1. Copy an existing file in `catalog/exercises/` and rename it to your slug (`kebab-case.json`).
2. Follow `catalog/SCHEMA.md`. Everything is in English.
3. Videos: link only (never re-host). Open each link yourself and confirm the technique is sound.
4. `npm run catalog:validate && npm run catalog:links`
5. Open a pull request. Dead links are reported by CI every week; fixing them is a welcome PR.

## Code
```bash
npm install
npm run dev        # builds the catalog, starts Vite
npm test
npm run typecheck
```
Keep dependencies minimal. UI code is Preact + TypeScript; pure logic lives in `src/logic.ts` and must have tests.
