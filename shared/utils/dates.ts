// Les dates telles qu'une créatrice les lit : « Tue 1 Dec », jamais « 2026-12-01 » (relecture UX du 20/11).
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}
export const toDay = (d: Date) => d.toISOString().slice(0, 10)
export function addDays(value: string, n: number): string {
  const d = parseDay(value)
  if (!d) return value
  d.setUTCDate(d.getUTCDate() + n)
  return toDay(d)
}
// « Tue 1 Dec » (avec l'année si elle n'est pas celle en cours).
export function nice(value: string | null | undefined, withYear = false): string {
  const d = parseDay(value)
  if (!d) return ''
  const year = d.getUTCFullYear() !== new Date().getUTCFullYear() || withYear ? ` ${d.getUTCFullYear()}` : ''
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${year}`
}
// Nombre de jours entre aujourd'hui et une date (négatif si passée).
export function daysUntil(value: string | null | undefined, today = toDay(new Date())): number | null {
  const d = parseDay(value)
  const t = parseDay(today)
  return d && t ? Math.round((d.getTime() - t.getTime()) / 86400000) : null
}
// La fenêtre de publication en une phrase : « between Thu 3 and Sat 5 Dec », « by Thu 3 Dec », ou rien.
export function postWindow(from: string | null | undefined, until: string | null | undefined): string {
  if (from && until && from !== until) return `between ${nice(from)} and ${nice(until)}`
  if (until) return `by ${nice(until)}`
  if (from) return `from ${nice(from)}`
  return ''
}
// La même date pour max : « dim. 22 nov. ».
const DAYS_FR = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
export function niceFr(value: string | null | undefined): string {
  const d = parseDay(value)
  return d ? `${DAYS_FR[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_FR[d.getUTCMonth()]}` : ''
}
