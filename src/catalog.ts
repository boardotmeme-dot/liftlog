import raw from './data/catalog.json'
import type { CatalogExercise, CustomExercise, Equipment, Muscle } from './types'
import type { Resolved } from './logic'

export const catalog = raw as unknown as CatalogExercise[]
const bySlug = new Map(catalog.map((e) => [e.slug, e]))

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest', back: 'Back', lats: 'Lats', traps: 'Traps', shoulders: 'Shoulders', 'rear-delts': 'Rear delts',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', quads: 'Quads', hamstrings: 'Hamstrings',
  glutes: 'Glutes', calves: 'Calves', abs: 'Abs', 'lower-back': 'Lower back', neck: 'Neck',
}
export const MUSCLES = Object.keys(MUSCLE_LABEL) as Muscle[]

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell', dumbbell: 'Dumbbell', machine: 'Machine', cable: 'Cable', bodyweight: 'Bodyweight',
  'ez-bar': 'EZ bar', kettlebell: 'Kettlebell', band: 'Band', 'smith-machine': 'Smith machine', other: 'Other',
}
export const EQUIPMENT = Object.keys(EQUIPMENT_LABEL) as Equipment[]

export function getExercise(slug: string): CatalogExercise | undefined {
  return bySlug.get(slug)
}

export function customKey(id: string): string {
  return 'custom:' + id
}

export function resolveKey(key: string, custom: CustomExercise[]): Resolved {
  const c = bySlug.get(key)
  if (c) return { name: c.name, group: c.muscle_group, equipment: c.equipment }
  if (key.startsWith('custom:')) {
    const u = custom.find((x) => customKey(x.id) === key)
    if (u) return { name: u.name, group: u.group, equipment: u.equipment }
  }
  return { name: key, group: 'back', equipment: 'other' }
}

export interface LibraryItem {
  key: string
  name: string
  group: Muscle
  equipment: Equipment
  custom: boolean
  haystack: string
}

export function libraryItems(custom: CustomExercise[]): LibraryItem[] {
  const items: LibraryItem[] = catalog.map((e) => ({
    key: e.slug, name: e.name, group: e.muscle_group, equipment: e.equipment, custom: false,
    haystack: [e.name, ...(e.aliases ?? []), MUSCLE_LABEL[e.muscle_group], ...e.secondary.map((m) => MUSCLE_LABEL[m]), EQUIPMENT_LABEL[e.equipment]].join(' ').toLowerCase(),
  }))
  for (const c of custom) {
    items.push({ key: customKey(c.id), name: c.name, group: c.group, equipment: c.equipment, custom: true,
      haystack: [c.name, MUSCLE_LABEL[c.group], EQUIPMENT_LABEL[c.equipment]].join(' ').toLowerCase() })
  }
  return items.sort((a, b) => a.name.localeCompare(b.name))
}

export function filterLibrary(items: LibraryItem[], q: string, group: Muscle | '', equipment: Equipment | ''): LibraryItem[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  return items.filter((i) => (!group || i.group === group) && (!equipment || i.equipment === equipment) && words.every((w) => i.haystack.includes(w)))
}
