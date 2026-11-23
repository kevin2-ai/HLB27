import { CONFIG } from '../config'

export function portoNovoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CONFIG.TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function weekStart(week: number) {
  return new Date(Date.UTC(2026, 10, 23 + (week - 1) * 7)).toISOString().slice(0, 10)
}

export function weekEnd(week: number) {
  return new Date(Date.UTC(2026, 10, 29 + (week - 1) * 7)).toISOString().slice(0, 10)
}

export function currentWeek(today = portoNovoDate()) {
  const delta = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${CONFIG.START_DATE}T00:00:00Z`)
  return Math.max(1, Math.min(CONFIG.TOTAL_WEEKS, Math.floor(delta / 604800000) + 1))
}

export function formatDateRange(week: number) {
  const formatter = new Intl.DateTimeFormat('fr-FR', { timeZone: CONFIG.TIMEZONE, day: 'numeric', month: 'short' })
  const start = new Date(`${weekStart(week)}T12:00:00Z`)
  const end = new Date(`${weekEnd(week)}T12:00:00Z`)
  return `${formatter.format(start)} – ${formatter.format(end)}`
}

export function formatPortoDateTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: CONFIG.TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
