import type { CardioActivity, CardioBlock, CardioPlan, CardioResult, CardioRun, CardioStep, GoogleExerciseType, StepKind, WorkoutLog } from './types'

const rid = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))

export const LEVEL_LABEL = { 1: 'Easy', 2: 'Steady', 3: 'Hard', 4: 'All out' } as const
export const KIND_LABEL: Record<StepKind, string> = { warmup: 'Warm-up', work: 'Work', rest: 'Rest', cooldown: 'Cool-down' }

export interface ActivityInfo {
  label: string
  icon: string
  /** label for the indoor switch ("Treadmill") */
  indoorLabel: string
  outdoorLabel: string
  /** show distance (km / mi) */
  distance: boolean
  /** what this activity is good for */
  about: string
  warmup: string[]
  cooldown: string[]
  /** work/rest wording used by new steps */
  workName: string
  restName: string
}

export const ACTIVITIES: Record<CardioActivity, ActivityInfo> = {
  'jump-rope': {
    label: 'Jump rope', icon: '⚡', indoorLabel: 'Indoors', outdoorLabel: 'Outdoors', distance: false, workName: 'Fast', restName: 'Slow',
    about: 'Burns a lot of energy in a short time, trains coordination, calves and endurance. All you need is a rope and a little space.',
    warmup: ['Ankle circles and calf raises, 30 seconds', 'Wrist and shoulder circles', '1-2 minutes of easy, low jumps without speed', 'A few light double-foot hops to find the rhythm'],
    cooldown: ['Walk it off until breathing is calm', 'Calf and shin stretch, 30 seconds per leg'],
  },
  bike: {
    label: 'Bike', icon: '🚴', indoorLabel: 'Stationary / trainer', outdoorLabel: 'Outdoors', distance: true, workName: 'Hard', restName: 'Easy',
    about: 'Low-impact leg endurance work, outdoors or on a stationary bike. Easy on the joints, so you can do a lot of it.',
    warmup: ['Spin in an easy gear, high cadence', 'Raise the effort a little every 2 minutes', 'Two or three 10 second pick-ups near the end'],
    cooldown: ['Easy spin with light resistance', 'Quad and hip flexor stretch'],
  },
  run: {
    label: 'Run', icon: '🏃', indoorLabel: 'Treadmill', outdoorLabel: 'Outdoors', distance: true, workName: 'Run', restName: 'Walk',
    about: 'The simplest way to build endurance. Outdoors or on a treadmill. Start easy and add intensity slowly.',
    warmup: ['Brisk walk, 2-3 minutes', 'Leg swings and walking lunges', 'Easy jog, then 3 relaxed 15 second strides'],
    cooldown: ['Walk until your heart rate drops below zone 2', 'Calf, hamstring and hip flexor stretch'],
  },
  walk: {
    label: 'Walk', icon: '🚶', indoorLabel: 'Treadmill', outdoorLabel: 'Outdoors', distance: true, workName: 'Brisk', restName: 'Easy',
    about: 'Gentle, joint-friendly cardio that suits every day, including recovery days after heavy lifting.',
    warmup: ['Start at an easy pace for 3-5 minutes', 'Loosen ankles, hips and shoulders'],
    cooldown: ['Slow the pace for the last 3 minutes', 'Gentle calf stretch'],
  },
  row: {
    label: 'Rowing', icon: '🚣', indoorLabel: 'Rowing machine', outdoorLabel: 'On the water', distance: true, workName: 'Hard', restName: 'Easy',
    about: 'Full-body cardio with low impact: legs, back and arms all work. Good technique matters more than speed.',
    warmup: ['5 minutes of easy rowing, 18-20 strokes per minute', 'Arms-only, then arms and body, then full slides', 'Three firm strokes near the end'],
    cooldown: ['Easy rowing for 3 minutes', 'Lat, hamstring and lower back stretch'],
  },
  swim: {
    label: 'Swim', icon: '🏊', indoorLabel: 'Pool', outdoorLabel: 'Open water', distance: true, workName: 'Fast', restName: 'Easy',
    about: 'Full-body endurance with no impact on the joints. Great for recovery and for people with sore knees.',
    warmup: ['Shoulder and arm circles on land', '200-400 m easy swimming, mixing strokes', 'A few short build-ups'],
    cooldown: ['100-200 m easy', 'Shoulder and chest stretch'],
  },
  elliptical: {
    label: 'Elliptical', icon: '⚙️', indoorLabel: 'Machine', outdoorLabel: 'Machine', distance: true, workName: 'Hard', restName: 'Easy',
    about: 'Smooth, low-impact cardio on a machine. Good when running or jumping bothers your joints.',
    warmup: ['5 minutes at low resistance', 'Increase resistance a little each minute'],
    cooldown: ['3 minutes at low resistance', 'Light leg stretch'],
  },
  other: {
    label: 'Other cardio', icon: '❤️', indoorLabel: 'Indoors', outdoorLabel: 'Outdoors', distance: false, workName: 'Work', restName: 'Rest',
    about: 'Any other cardio activity: classes, hiking, skating and so on. Edit the steps to fit what you do.',
    warmup: ['5 minutes of easy movement', 'Mobilise the joints you are about to use'],
    cooldown: ['Walk or move easily until calm', 'Light stretch'],
  },
}

export const ACTIVITY_KEYS = Object.keys(ACTIVITIES) as CardioActivity[]

/** Exercise type to write to Google Health. */
export function googleType(activity: CardioActivity, indoor: boolean): GoogleExerciseType {
  switch (activity) {
    case 'jump-rope': return 'JUMPING_ROPE'
    case 'bike': return indoor ? 'STATIONARY_BIKE' : 'BIKING'
    case 'run': return indoor ? 'TREADMILL' : 'RUNNING'
    case 'walk': return indoor ? 'TREADMILL_WALK' : 'WALKING'
    case 'row': return indoor ? 'ROWING_MACHINE' : 'ROWING'
    case 'swim': return indoor ? 'SWIMMING_POOL' : 'SWIMMING_OPEN_WATER'
    case 'elliptical': return 'ELLIPTICAL'
    default: return 'OTHER'
  }
}

/* ---------- building programs ---------- */

type Level = CardioStep['level']
export const step = (kind: StepKind, label: string, sec: number, level: Level): CardioStep => ({ id: rid(), kind, label, sec, level })
const block = (repeat: number, ...steps: CardioStep[]): CardioBlock => ({ id: rid(), repeat, steps })

const warm = (min: number) => block(1, step('warmup', 'Warm-up', min * 60, 1))
const cool = (min: number) => block(1, step('cooldown', 'Cool-down', min * 60, 1))

export interface StyleAbout {
  /** what this style is */
  what: string
  /** how to do it, in plain steps */
  how: string
  /** what it trains and who it suits */
  good: string
}

export interface CardioStyle {
  name: string
  hint: string
  about: StyleAbout
  build: (a: ActivityInfo) => CardioBlock[]
}

const steady = (name: string, warmMin: number, min: number, level: Level, coolMin: number, hint: string, about: StyleAbout): CardioStyle => ({
  name, hint, about, build: () => [warm(warmMin), block(1, step('work', 'Steady', min * 60, level)), cool(coolMin)],
})
const intervals = (name: string, hint: string, warmMin: number, rounds: number, workSec: number, restSec: number, workLevel: Level, coolMin: number, about: StyleAbout): CardioStyle => ({
  name, hint, about,
  build: (a) => [warm(warmMin), block(rounds, step('work', a.workName, workSec, workLevel), step('rest', a.restName, restSec, 1)), cool(coolMin)],
})

const EASY: StyleAbout = {
  what: 'Easy, even effort for a long time. You should be able to hold a conversation the whole way.',
  how: 'Keep the pace comfortable from start to finish (heart rate zone 2). If you cannot talk in full sentences, slow down.',
  good: 'Builds your aerobic base and burns fat with little stress on the body. Safe to do often, a good fit between hard strength days.',
}

export const STYLES: Record<CardioActivity, CardioStyle[]> = {
  'jump-rope': [
    intervals('Speed intervals', '10 x 30 s fast, 30 s slow', 3, 10, 30, 30, 4, 2, {
      what: 'Ten rounds: 30 seconds of fast jumping, then 30 seconds of slow, relaxed jumping.',
      how: 'Fast: quick light bounces, as many as you can keep clean. Slow: easy jumps, shake out your arms and breathe. The timer beeps at every change.',
      good: 'Raises your heart rate quickly and trains speed and recovery. 15 minutes in total, ideal when you are short on time.',
    }),
    intervals('Boxer rounds', '5 x 3 min jumping, 1 min rest', 3, 5, 180, 60, 3, 2, {
      what: 'Five 3-minute rounds like in boxing, with a 1-minute rest between them.',
      how: 'Jump at a steady rhythm for the whole round, mixing in basic bounce, alternate-foot step and side swings. Rest by walking and drinking.',
      good: 'Builds endurance, rhythm and calf strength. Longer rounds make it harder than 30/30 intervals, so it suits people who can already jump for 2-3 minutes in a row.',
    }),
    intervals('Tabata', '8 x 20 s all out, 10 s rest', 3, 8, 20, 10, 4, 2, {
      what: 'The classic Tabata protocol: 8 rounds of 20 seconds all out and 10 seconds rest. Only 4 minutes of work.',
      how: 'Go as fast as you can for 20 seconds (double-unders or high knees if you can), then 10 seconds to catch your breath. Do not pace yourself: the short rest is what makes it hard.',
      good: 'Very high intensity in very little time, improves both endurance and sprint power. Intense: do it at most 2 times a week and skip it on tired days.',
    }),
    {
      name: 'Pyramid', hint: '30 / 45 / 60 / 45 / 30 s fast with 30 s slow between',
      about: {
        what: 'Fast rounds that grow longer, then shorter again: 30, 45, 60, 45, 30 seconds, with 30 seconds of slow jumping between them.',
        how: 'Fast rounds at a pace you can hold for the whole round, the 60 s peak is the hardest. Use the slow 30 s to recover fully.',
        good: 'A gentle way to build up to longer efforts and learn to pace yourself. Good for beginners and intermediates.',
      },
      build: (a) => [warm(3), block(1,
        ...[30, 45, 60, 45, 30].flatMap((s, i, all) => [step('work', a.workName, s, 4), ...(i < all.length - 1 ? [step('rest', a.restName, 30, 1)] : [])])), cool(2)],
    },
    steady('Steady jumping', 3, 15, 2, 2, '15 minutes at an even rhythm', {
      what: 'Fifteen minutes of continuous jumping at a rhythm you can keep up.',
      how: 'Basic bounce at about 100-120 jumps per minute. Short breaks are fine if you trip: just restart the rhythm.',
      good: 'Builds endurance and coordination. The best choice while you are learning the movement.',
    }),
  ],
  bike: [
    steady('Easy ride', 5, 40, 2, 5, '40 minutes in zone 2', EASY),
    intervals('Intervals 1/1', '8 x 1 min hard, 1 min easy', 5, 8, 60, 60, 3, 5, {
      what: 'Eight rounds of 1 minute hard riding followed by 1 minute of easy spinning.',
      how: 'Hard: raise the resistance or speed to an effort you could only keep for about 5 more minutes. Easy: spin lightly until your breathing calms down.',
      good: 'Improves fitness and power faster than steady riding, in about 25 minutes.',
    }),
    steady('Tempo', 10, 20, 3, 5, '20 minutes at a hard but even effort', {
      what: 'Twenty minutes at a "comfortably hard" effort: harder than easy riding, but you can keep it even.',
      how: 'You can speak only in short phrases. Hold the same effort for the whole 20 minutes, do not start too fast.',
      good: 'Raises the effort you can sustain for a long time. Good for cyclists and anyone who wants more stamina.',
    }),
    intervals('Sprints', '8 x 20 s all out, 100 s easy', 8, 8, 20, 100, 4, 5, {
      what: 'Eight all-out sprints of 20 seconds, each followed by 100 seconds of easy spinning.',
      how: 'Sprint with maximum effort at high resistance, then spin very easy to recover fully before the next one. Quality matters more than quantity.',
      good: 'Trains power and anaerobic fitness. Hard on the legs: do not do it right before a heavy leg day.',
    }),
  ],
  run: [
    steady('Easy run', 5, 30, 2, 5, '30 minutes you can chat through', EASY),
    intervals('Intervals', '6 x 2 min hard, 2 min easy', 8, 6, 120, 120, 3, 5, {
      what: 'Six rounds of 2 minutes of hard running with 2 minutes of easy jogging or walking.',
      how: 'Hard: a fast pace you can keep for the full 2 minutes (not a sprint). Easy: jog slowly until you recover. Keep the hard rounds at the same pace.',
      good: 'Improves speed and the effort you can sustain. It also burns more energy than an easy run of the same length.',
    }),
    steady('Tempo run', 10, 20, 3, 5, '20 minutes comfortably hard', {
      what: 'A 20-minute run at a pace that is hard but even, after a 10-minute warm-up.',
      how: 'Aim for about the pace you could hold for an hour in a race. You can say a few words, not a sentence. Keep it even from the first to the last minute.',
      good: 'Raises your lactate threshold, the speed you can keep for a long time. The main workout for getting faster at 5-10 km.',
    }),
    intervals('Fartlek', '8 x 1 min hard, 2 min easy', 8, 8, 60, 120, 3, 5, {
      what: 'Swedish for "speed play": alternating faster and easy running. Here: 8 times 1 minute fast and 2 minutes easy.',
      how: 'Run fast by feel for each minute, then jog easily. Less strict than track intervals, so it works on any route or treadmill.',
      good: 'Builds speed and endurance in a relaxed way. A good first step into harder running workouts.',
    }),
    intervals('Sprints', '8 x 30 s all out, 90 s walk', 8, 8, 30, 90, 4, 5, {
      what: 'Eight sprints of 30 seconds at maximum effort, each followed by 90 seconds of walking.',
      how: 'Sprint hard but with good form, then walk until your heart rate drops. Warm up well, short sprints are demanding on calves and hamstrings.',
      good: 'Develops speed and power and gives a high calorie burn. Do it once a week at most.',
    }),
    intervals('Run / walk', '8 x 2 min run, 1 min walk (good for beginners)', 3, 8, 120, 60, 2, 3, {
      what: 'Alternating 2 minutes of easy running with 1 minute of walking, 8 times.',
      how: 'Run slowly enough that you could talk. Walk briskly in the break. Over the weeks lengthen the run part and shorten the walk part by editing the steps.',
      good: 'The safest way to start running or come back after a break. You build endurance without overloading joints.',
    }),
    steady('Long run', 5, 60, 2, 5, '60 minutes at an easy pace', {
      what: 'One long run at an easy pace, 60 minutes by default.',
      how: 'Start slower than you think you need to. Take water along. The pace should stay easy to the end.',
      good: 'Builds endurance and mental toughness. Once a week is plenty.',
    }),
  ],
  walk: [
    steady('Brisk walk', 3, 30, 2, 3, '30 minutes at a quick pace', {
      what: 'Thirty minutes of walking fast enough to raise your breathing, but still able to talk.',
      how: 'Walk with long steps and swinging arms, about 100-120 steps per minute. Use the 3-minute warm-up to start slowly.',
      good: 'Easy on the joints, good for heart health and recovery days. Suitable for everyone.',
    }),
    intervals('Power intervals', '6 x 3 min brisk, 2 min easy', 3, 6, 180, 120, 3, 3, {
      what: 'Alternating 3 minutes of very brisk walking (or incline on a treadmill) with 2 minutes of easy walking.',
      how: 'Brisk: walk so fast that talking gets difficult, add a treadmill incline of 5-10 % if you have one. Easy: normal relaxed pace.',
      good: 'Raises fitness faster than a steady walk, with much less impact than running.',
    }),
    steady('Easy walk', 0, 45, 1, 0, '45 minutes, relaxed', {
      what: 'A relaxed 45-minute walk with no warm-up needed.',
      how: 'Walk at a comfortable pace and enjoy it. Good for a recovery day or a break from lifting.',
      good: 'Active recovery: promotes blood flow and burns a little energy without any strain.',
    }),
  ],
  row: [
    steady('Steady row', 5, 20, 2, 3, '20 minutes at an even stroke rate', {
      what: 'Twenty minutes of continuous rowing at an easy to moderate effort.',
      how: 'Keep a stroke rate of 18-22 per minute. Drive with the legs, then lean back, then pull the arms, and return in reverse order.',
      good: 'Whole-body endurance work with low impact. Also a good way to train technique.',
    }),
    intervals('Intervals', '8 x 2 min hard, 1 min easy', 5, 8, 120, 60, 3, 3, {
      what: 'Eight rounds of 2 minutes hard rowing and 1 minute easy rowing.',
      how: 'Hard rounds at a pace you can hold for 2 minutes with good technique, stroke rate 24-28. Easy: row lightly or rest.',
      good: 'Builds strong endurance and uses your whole body, about 27 minutes in total.',
    }),
    intervals('Sprints', '10 x 30 s all out, 90 s easy', 5, 10, 30, 90, 4, 3, {
      what: 'Ten all-out 30-second sprints with 90 seconds of easy rowing between them.',
      how: 'Row with maximum power but keep the technique clean. Recover fully in the easy part.',
      good: 'Trains power and anaerobic capacity. Very demanding: do it only when you are fresh.',
    }),
  ],
  swim: [
    steady('Steady swim', 5, 25, 2, 3, '25 minutes continuous', {
      what: 'Twenty-five minutes of continuous swimming at an easy to moderate effort.',
      how: 'Keep a pace you can maintain without stopping. Rest at the wall briefly if you must and continue.',
      good: 'Full-body endurance with no impact on the joints.',
    }),
    intervals('Intervals', '8 x 1 min fast, 30 s rest', 5, 8, 60, 30, 3, 3, {
      what: 'Eight times 1 minute of fast swimming with 30 seconds of rest at the wall.',
      how: 'Swim fast but with good technique. Use the rest to breathe, not to stop completely.',
      good: 'Improves swimming speed and fitness in a short session.',
    }),
  ],
  elliptical: [
    steady('Steady', 5, 25, 2, 3, '25 minutes', {
      what: 'Twenty-five minutes of continuous work on the elliptical at a moderate effort.',
      how: 'Stand upright, hold the handles lightly, push through the whole foot. Keep resistance so that the movement stays smooth.',
      good: 'Low-impact cardio, good for joints and for recovery days.',
    }),
    intervals('Intervals', '8 x 1 min hard, 1 min easy', 5, 8, 60, 60, 3, 3, {
      what: 'Eight rounds of 1 minute hard with 1 minute easy.',
      how: 'Hard: raise resistance and speed. Easy: lower both and let your heart rate settle.',
      good: 'More effective than steady work in less time, still no impact.',
    }),
  ],
  other: [
    steady('Steady', 5, 20, 2, 3, '20 minutes', {
      what: 'Twenty minutes of any continuous cardio activity you choose.',
      how: 'Keep an even moderate effort. Edit the steps to match your activity.',
      good: 'A simple template for activities that are not in the list.',
    }),
    intervals('Intervals', '8 x 30 s work, 30 s rest', 5, 8, 30, 30, 3, 3, {
      what: 'Eight rounds of 30 seconds of work and 30 seconds of rest for any activity.',
      how: 'Work hard in the work step, relax fully in the rest. Change the times in the editor to make it easier or harder.',
      good: 'A flexible interval template.',
    }),
  ],
}

/** Plain-language explanation of a step type and of the effort levels, shown in menus and the editor. */
export const KIND_HELP: Record<StepKind, string> = {
  warmup: 'Easy movement that raises your heart rate and loosens the joints before the hard part.',
  work: 'The effort part of the program. The timer beeps twice when it starts.',
  rest: 'Easy recovery between efforts. The timer gives one low beep when it starts.',
  cooldown: 'Easy movement at the end that lets your heart rate come down.',
}
export const LEVEL_HELP: Record<1 | 2 | 3 | 4, string> = {
  1: 'Easy: you can talk freely (about 50-60 % of max heart rate).',
  2: 'Steady: you can talk in sentences (60-70 %).',
  3: 'Hard: only short phrases (80-90 %).',
  4: 'All out: you cannot talk, maximum effort you can keep for a short time.',
}

export function planFromStyle(activity: CardioActivity, styleName: string, indoor = false): CardioPlan {
  const info = ACTIVITIES[activity]
  const style = STYLES[activity].find((s) => s.name === styleName) ?? STYLES[activity][0]
  return { activity, indoor, style: style.name, blocks: style.build(info) }
}

/** A blank step for the editor. */
export function newStep(activity: CardioActivity, kind: StepKind): CardioStep {
  const a = ACTIVITIES[activity]
  if (kind === 'work') return step('work', a.workName, 60, 3)
  if (kind === 'rest') return step('rest', a.restName, 30, 1)
  if (kind === 'warmup') return step('warmup', 'Warm-up', 180, 1)
  return step('cooldown', 'Cool-down', 180, 1)
}

export const newBlock = (activity: CardioActivity): CardioBlock => block(1, newStep(activity, 'work'), newStep(activity, 'rest'))

/* ---------- running a program ---------- */

export interface FlatStep extends CardioStep {
  /** which repeat of its block (1-based) and how many */
  round: number
  rounds: number
  blockIndex: number
  startSec: number
}

/** The program as one timeline. */
export function expand(plan: CardioPlan): FlatStep[] {
  const out: FlatStep[] = []
  let t = 0
  plan.blocks.forEach((b, blockIndex) => {
    for (let round = 1; round <= b.repeat; round++) {
      for (const s of b.steps) {
        out.push({ ...s, round, rounds: b.repeat, blockIndex, startSec: t })
        t += s.sec
      }
    }
  })
  return out
}

export const totalSec = (flat: FlatStep[]): number => (flat.length ? flat[flat.length - 1].startSec + flat[flat.length - 1].sec : 0)

export interface Progress {
  /** index of the current step; flat.length when the program is over */
  index: number
  /** seconds into the current step */
  into: number
  left: number
  done: boolean
}

export function progressAt(flat: FlatStep[], posSec: number): Progress {
  const total = totalSec(flat)
  if (flat.length === 0 || posSec >= total) return { index: flat.length, into: 0, left: 0, done: true }
  let i = flat.findIndex((s) => posSec < s.startSec + s.sec)
  if (i < 0) i = flat.length - 1
  const s = flat[i]
  return { index: i, into: posSec - s.startSec, left: s.startSec + s.sec - posSec, done: false }
}

export function runPositionSec(run: CardioRun, now: number): number {
  return Math.max(0, ((run.pausedAt ?? now) - run.startedAt - run.pausedMs + run.skipMs) / 1000)
}

/** Milliseconds to add to `skipMs` to jump to the next step (dir 1) or restart/go back (dir -1). */
export function skipDeltaMs(flat: FlatStep[], posSec: number, dir: 1 | -1): number {
  const p = progressAt(flat, posSec)
  if (p.done) return 0
  const cur = flat[p.index]
  let target: number
  if (dir > 0) target = cur.startSec + cur.sec
  else if (p.into > 3 || p.index === 0) target = cur.startSec
  else target = flat[p.index - 1].startSec
  return Math.round((target - posSec) * 1000)
}

/** What was done after `posSec` of the program. */
export function resultAt(plan: CardioPlan, flat: FlatStep[], posSec: number): Pick<CardioResult, 'activity' | 'indoor' | 'style' | 'workSec' | 'rounds'> & { warmSec: number } {
  let workSec = 0
  let warmSec = 0
  let rounds = 0
  for (const s of flat) {
    const spent = Math.max(0, Math.min(s.sec, posSec - s.startSec))
    if (s.kind === 'work') { workSec += spent; if (spent >= s.sec) rounds++ }
    if (s.kind === 'warmup') warmSec += spent
  }
  return { activity: plan.activity, indoor: plan.indoor, style: plan.style, workSec: Math.round(workSec), rounds, warmSec: Math.round(warmSec) }
}

/** "2:30", "45 s", "1 h 05 min" for plan summaries. */
export function dur(sec: number): string {
  const s = Math.round(sec)
  if (s < 60) return `${s} s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`
  return r ? `${m}:${String(r).padStart(2, '0')} min` : `${m} min`
}

/** One line describing the program: "Warm-up 3 min · 10 × (Fast 30 s + Slow 30 s) · Cool-down 2 min". */
export function describe(plan: CardioPlan): string {
  return plan.blocks.map((b) => {
    const parts = b.steps.map((s) => `${s.label} ${dur(s.sec)}`)
    return b.repeat > 1 ? `${b.repeat} × (${parts.join(' + ')})` : parts.join(' + ')
  }).join(' · ')
}

/* ---------- validation of stored data ---------- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const KINDS = new Set<StepKind>(['warmup', 'work', 'rest', 'cooldown'])

export function normalizeCardio(input: unknown): CardioPlan | null {
  if (!isObj(input) || !Array.isArray(input.blocks)) return null
  const activity = ACTIVITY_KEYS.includes(input.activity as CardioActivity) ? (input.activity as CardioActivity) : 'other'
  const blocks: CardioBlock[] = []
  for (const b of input.blocks.slice(0, 40)) {
    if (!isObj(b) || !Array.isArray(b.steps)) continue
    const steps: CardioStep[] = []
    for (const s of b.steps.slice(0, 40)) {
      if (!isObj(s) || !KINDS.has(s.kind as StepKind)) continue
      const level = Math.min(4, Math.max(1, Math.round(Number(s.level) || 2))) as Level
      steps.push({
        id: typeof s.id === 'string' ? s.id : rid(),
        kind: s.kind as StepKind,
        label: typeof s.label === 'string' ? s.label.slice(0, 40) : KIND_LABEL[s.kind as StepKind],
        sec: Math.min(6 * 3600, Math.max(1, Math.round(Number(s.sec) || 60))),
        level,
      })
    }
    if (steps.length) blocks.push({ id: typeof b.id === 'string' ? b.id : rid(), repeat: Math.min(100, Math.max(1, Math.round(Number(b.repeat) || 1))), steps })
  }
  if (blocks.length === 0) return null
  const km = Number(input.targetKm)
  return {
    activity,
    indoor: input.indoor === true,
    style: typeof input.style === 'string' ? input.style.slice(0, 40) : 'Custom',
    blocks,
    targetKm: Number.isFinite(km) && km > 0 ? Math.min(1000, km) : undefined,
  }
}

export interface CardioTotals {
  activity: CardioActivity
  sessions: number
  /** active minutes */
  minutes: number
  km: number
  /** seconds of work time and km of the sessions that have a distance, for pace */
  paceSec: number
  paceKm: number
  longestMin: number
}

/** Cardio sessions since `since`, grouped by activity, most minutes first. */
export function cardioTotals(logs: WorkoutLog[], since: number): CardioTotals[] {
  const by = new Map<CardioActivity, CardioTotals>()
  for (const l of logs) {
    if (l.deletedAt || !l.cardio || l.endedAt < since) continue
    const c = l.cardio
    const t = by.get(c.activity) ?? { activity: c.activity, sessions: 0, minutes: 0, km: 0, paceSec: 0, paceKm: 0, longestMin: 0 }
    t.sessions++
    t.minutes += l.durationSec / 60
    t.longestMin = Math.max(t.longestMin, l.durationSec / 60)
    if (c.km) { t.km += c.km; t.paceSec += c.workSec || l.durationSec; t.paceKm += c.km }
    by.set(c.activity, t)
  }
  return [...by.values()].map((t) => ({ ...t, minutes: Math.round(t.minutes), longestMin: Math.round(t.longestMin), km: Math.round(t.km * 100) / 100 })).sort((a, b) => b.minutes - a.minutes)
}
