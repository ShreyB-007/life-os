export const GOAL_COLOR_OPTIONS = [
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Rose', value: '#F43F5E' },
]

export const GOAL_ICON_OPTIONS = [
  'target',
  'rocket',
  'school',
  'file-text',
  'building-factory',
  'briefcase',
  'book',
  'trophy',
]

export function clampProgress(value) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return 0
  return Math.min(100, Math.max(0, parsed))
}

export function compareDateStrings(a, b) {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b)
}

export function formatTargetDate(dateString) {
  if (!dateString) return 'No target'

  const [year, month, day] = dateString.split('-').map(Number)
  if (!year || !month || !day) return 'Invalid date'

  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function buildDefaultGoal(sortOrder) {
  return {
    name: '',
    icon: 'target',
    color: GOAL_COLOR_OPTIONS[0].value,
    progress_pct: 0,
    target_date: '',
    label: '',
    status: 'active',
    sort_order: sortOrder,
  }
}
