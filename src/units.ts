export type Unit = 'kg' | 'lb'

/** All weights are stored in kilograms. These helpers convert for display and input. */
const LB_PER_KG = 2.2046226218
const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits

export const toDisplay = (kg: number, unit: Unit): number => (unit === 'kg' ? round(kg, 2) : round(kg * LB_PER_KG, 1))
export const fromDisplay = (value: number, unit: Unit): number => (unit === 'kg' ? round(value, 2) : round(value / LB_PER_KG, 4))

/** Size of the +/- buttons. */
export const stepFor = (unit: Unit): number => (unit === 'kg' ? 2.5 : 5)

export const fmtWeight = (kg: number | null | undefined, unit: Unit): string => (kg === null || kg === undefined ? '—' : `${toDisplay(kg, unit)} ${unit}`)

/** Total lifted: tonnes for large kg totals, otherwise the plain number. */
export function fmtVolume(kg: number, unit: Unit): string {
  if (!kg) return '—'
  if (unit === 'lb') return `${Math.round(kg * LB_PER_KG).toLocaleString()} lb`
  return kg >= 1000 ? `${round(kg / 1000, 1)} t` : `${Math.round(kg)} kg`
}

/** US-style locales default to pounds on first run. */
export function defaultUnit(locale: string | undefined): Unit {
  return /^en-(US|LR)$|^my-MM$/i.test(locale ?? '') ? 'lb' : 'kg'
}

const MI_PER_KM = 0.6213712
/** Distances are stored in kilometres; pound users see miles. */
export const distToDisplay = (km: number, unit: Unit): number => (unit === 'kg' ? round(km, 2) : round(km * MI_PER_KM, 2))
export const distFromDisplay = (value: number, unit: Unit): number => (unit === 'kg' ? round(value, 3) : round(value / MI_PER_KM, 3))
export const distUnit = (unit: Unit): string => (unit === 'kg' ? 'km' : 'mi')
export const fmtDistance = (km: number | null | undefined, unit: Unit): string => (km === null || km === undefined ? '—' : `${distToDisplay(km, unit)} ${distUnit(unit)}`)
/** Average pace as min per km (or mile): "5:42 /km". */
export function fmtPace(sec: number, km: number, unit: Unit): string {
  if (!(km > 0) || !(sec > 0)) return '—'
  const per = sec / (unit === 'kg' ? km : km * MI_PER_KM)
  return `${Math.floor(per / 60)}:${String(Math.round(per % 60)).padStart(2, '0')} /${distUnit(unit)}`
}
