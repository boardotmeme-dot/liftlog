# Exercise catalog format

One JSON file per exercise in `catalog/exercises/<slug>.json`. The file name must equal `slug`.
Everything is written in English. Run `npm run catalog:validate` before opening a PR.

```json
{
  "slug": "barbell-back-squat",
  "name": "Barbell Back Squat",
  "aliases": ["Back Squat", "Squat"],
  "muscle_group": "quads",
  "secondary": ["glutes", "hamstrings", "abs"],
  "equipment": "barbell",
  "mechanic": "compound",
  "level": "intermediate",
  "summary": "One or two sentences: what it trains and why it is useful.",
  "setup": ["Step 1 ...", "Step 2 ..."],
  "execution": ["Step 1 ...", "Step 2 ..."],
  "cues": ["Short coaching cue", "Another cue"],
  "mistakes": ["Common mistake and how to fix it"],
  "default_sets": 3,
  "default_reps": "8-12",
  "references": [
    {
      "type": "video",
      "platform": "youtube",
      "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX",
      "title": "Exact title of the video",
      "author": "Channel name",
      "checked": "2026-10-23"
    }
  ]
}
```

## Allowed values

| field | values |
|---|---|
| `muscle_group` | `chest`, `back`, `lats`, `traps`, `shoulders`, `rear-delts`, `biceps`, `triceps`, `forearms`, `quads`, `hamstrings`, `glutes`, `calves`, `abs`, `lower-back`, `neck` |
| `secondary` | any list of the values above (may be empty) |
| `equipment` | `barbell`, `dumbbell`, `machine`, `cable`, `bodyweight`, `ez-bar`, `kettlebell`, `band`, `smith-machine`, `other` |
| `mechanic` | `compound`, `isolation` |
| `level` | `beginner`, `intermediate`, `advanced` |
| `references[].type` | `video`, `article` |
| `references[].platform` | `youtube`, `tiktok`, `instagram`, `web` |

## Rules for references

* Link only. Never download, re-host or embed copies of someone else's video.
* Every reference must be a real, public URL that you have actually opened or confirmed
  (`npm run catalog:links` checks YouTube/TikTok through their oEmbed endpoints).
* `title` and `author` must match what the platform reports.
* At least one `video` reference per exercise. Two is better (a different author).
* Prefer instructors with a record of sound technique (physiotherapists, strength coaches,
  evidence-based channels). Do not link anything that shows unsafe form.

## Rules for text

* `setup` and `execution`: 3-6 short imperative steps each.
* `cues`: 2-4 short coaching cues. `mistakes`: 2-4 items, each with the fix.
* No medical claims. No brand names.
