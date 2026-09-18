/**
 * Local-date utilities.
 *
 * All date comparisons in the app must use the user's LOCAL date, not UTC.
 * `new Date().toISOString().slice(0, 10)` returns the UTC date, which can
 * be one day behind the user's local calendar (e.g. IST = UTC+5:30: at
 * 12:30 AM local time, UTC is still 7 PM "yesterday").
 */

export function getLocalDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getLocalDate() {
  return getLocalDateString(new Date())
}

// Monday-Sunday week bounds for a given local date string ('YYYY-MM-DD').
// Shared by GymCard's rest-day cap and the weekly review's aggregation window
// so "week" means the same thing everywhere in the app.
export function getWeekBounds(dateStr) {
  const selected = new Date(`${dateStr}T00:00:00`)
  const daysToMonday = (selected.getDay() + 6) % 7
  const monday = new Date(selected)
  monday.setDate(selected.getDate() - daysToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    mondayStr: getLocalDateString(monday),
    sundayStr: getLocalDateString(sunday),
  }
}
