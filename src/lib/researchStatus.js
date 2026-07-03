function daysBetween(fromDate, toDate) {
  const start = new Date(fromDate)
  const end = new Date(toDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 999

  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return Math.floor((end - start) / 86400000)
}

export function getResearchStatus(entity) {
  if (!entity?.static_researched_at) return 'unresearched'

  const daysSinceDynamic = entity.dynamic_refreshed_at
    ? daysBetween(entity.dynamic_refreshed_at, new Date())
    : 999

  if (daysSinceDynamic > 180) return 'stale'
  return 'complete'
}

export function getStatusColor(status) {
  return {
    unresearched: '#4A4A60',
    stale: '#F59E0B',
    complete: '#10B981',
  }[status]
}

export function getStatusLabel(entity) {
  const status = getResearchStatus(entity)
  if (status === 'unresearched') return 'Not yet researched'
  if (status === 'stale') return 'Data may be stale'

  const researchedAt = entity.static_researched_at
    ? new Date(entity.static_researched_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return researchedAt ? `Researched ${researchedAt}` : 'Up to date'
}

export function hasPersonalNotes(entity) {
  return entity?.personal_notes?.trim().length > 0
}
