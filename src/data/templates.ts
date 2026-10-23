import type { PlanDay } from '../types'
import { uid } from '../logic'

/** [catalog slug, sets, reps, starting kg or null] */
type Row = [string, number, string, number | null]
interface Template {
  id: string
  name: string
  description: string
  days: { title: string; focus: string; rows: Row[] }[]
}

export const TEMPLATES: Template[] = [
  {
    id: 'full-body-3',
    name: 'Full body, 3 days',
    description: 'Three whole-body sessions a week. A good first program.',
    days: [
      { title: 'Day A', focus: 'Squat and push', rows: [
        ['barbell-back-squat', 3, '5-8', null], ['barbell-bench-press', 3, '5-8', null], ['seated-cable-row', 3, '8-12', null],
        ['dumbbell-lateral-raise', 3, '12-15', null], ['triceps-rope-pushdown', 2, '10-15', null], ['plank', 3, '30-60 s', null]] },
      { title: 'Day B', focus: 'Hinge and pull', rows: [
        ['romanian-deadlift', 3, '6-10', null], ['barbell-overhead-press', 3, '6-10', null], ['wide-grip-lat-pulldown', 3, '8-12', null],
        ['dumbbell-reverse-lunge', 3, '8-12', null], ['dumbbell-hammer-curl', 2, '10-15', null], ['hanging-leg-raise', 3, '8-12', null]] },
      { title: 'Day C', focus: 'Mixed', rows: [
        ['leg-press', 3, '8-12', null], ['incline-dumbbell-press', 3, '8-12', null], ['one-arm-dumbbell-row', 3, '8-12', null],
        ['face-pull', 3, '12-20', null], ['standing-calf-raise', 3, '10-15', null], ['cable-crunch', 3, '10-15', null]] },
    ],
  },
  {
    id: 'upper-lower-4',
    name: 'Upper / lower, 4 days',
    description: 'Two upper and two lower days. More volume per muscle than full body.',
    days: [
      { title: 'Upper 1', focus: 'Horizontal push and pull', rows: [
        ['barbell-bench-press', 4, '6-8', null], ['barbell-bent-over-row', 4, '6-8', null], ['seated-dumbbell-shoulder-press', 3, '8-12', null],
        ['wide-grip-lat-pulldown', 3, '8-12', null], ['ez-bar-curl', 3, '8-12', null], ['triceps-rope-pushdown', 3, '10-15', null]] },
      { title: 'Lower 1', focus: 'Squat focus', rows: [
        ['barbell-back-squat', 4, '5-8', null], ['romanian-deadlift', 3, '8-10', null], ['leg-extension', 3, '10-15', null],
        ['lying-leg-curl', 3, '10-15', null], ['standing-calf-raise', 4, '10-15', null], ['plank', 3, '30-60 s', null]] },
      { title: 'Upper 2', focus: 'Vertical push and pull', rows: [
        ['barbell-overhead-press', 4, '6-8', null], ['pull-up', 4, '6-10', null], ['incline-dumbbell-press', 3, '8-12', null],
        ['seated-cable-row', 3, '8-12', null], ['dumbbell-lateral-raise', 3, '12-15', null], ['incline-dumbbell-curl', 3, '10-12', null]] },
      { title: 'Lower 2', focus: 'Hinge focus', rows: [
        ['conventional-deadlift', 3, '3-5', null], ['bulgarian-split-squat', 3, '8-12', null], ['barbell-hip-thrust', 3, '8-12', null],
        ['seated-leg-curl', 3, '10-15', null], ['seated-calf-raise', 4, '12-15', null], ['hanging-leg-raise', 3, '8-12', null]] },
    ],
  },
  {
    id: 'full-body-4',
    name: 'Full body, 4 days',
    description: 'Four whole-body days with different emphasis. This is the plan liftlog started from.',
    days: [
      { title: 'Day 1', focus: 'Chest and quads', rows: [
        ['barbell-back-squat', 4, '8', null], ['barbell-bench-press', 4, '8', null], ['barbell-bent-over-row', 4, '10', null],
        ['seated-dumbbell-shoulder-press', 3, '12', null], ['bent-over-dumbbell-rear-delt-fly', 3, '15', null],
        ['close-grip-bench-press', 3, '12', null], ['single-leg-dumbbell-calf-raise', 4, '15', null], ['plank', 3, '30-60 s', null]] },
      { title: 'Day 2', focus: 'Posterior chain and back', rows: [
        ['romanian-deadlift', 4, '10', null], ['dumbbell-reverse-lunge', 3, '12', null], ['wide-grip-lat-pulldown', 4, '10', null],
        ['incline-barbell-bench-press', 4, '10', null], ['one-arm-dumbbell-row', 3, '12', null], ['seated-dumbbell-lateral-raise', 3, '15', null],
        ['ez-bar-curl', 3, '12', null], ['crunch', 3, '15', null]] },
      { title: 'Day 3', focus: 'Shoulders and upper chest', rows: [
        ['bulgarian-split-squat', 4, '12', null], ['incline-dumbbell-fly', 3, '12', null], ['t-bar-row', 4, '10', null],
        ['barbell-upright-row', 3, '12', null], ['face-pull', 3, '15', null], ['triceps-rope-pushdown', 3, '12', null],
        ['dumbbell-hammer-curl', 3, '12', null], ['crunch', 3, '15', null]] },
      { title: 'Day 4', focus: 'Legs and arms', rows: [
        ['barbell-hip-thrust', 4, '12', null], ['leg-extension', 3, '15', null], ['close-grip-lat-pulldown', 4, '10', null],
        ['push-up', 3, 'to failure', null], ['seated-dumbbell-shoulder-press', 3, '12', null], ['preacher-curl', 3, '12', null],
        ['lying-triceps-extension', 3, '12', null], ['back-extension', 3, '15', null]] },
    ],
  },
]

export function planFromTemplate(id: string, known: (slug: string) => boolean): PlanDay[] {
  const t = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0]
  return t.days.map((d) => ({
    id: uid(),
    title: d.title,
    focus: d.focus,
    exercises: d.rows.filter(([slug]) => known(slug)).map(([slug, sets, reps, kg]) => ({ id: uid(), key: slug, kg, sets, reps, note: '' })),
  }))
}

export function templateSlugs(): string[] {
  return [...new Set(TEMPLATES.flatMap((t) => t.days.flatMap((d) => d.rows.map((r) => r[0]))))]
}
