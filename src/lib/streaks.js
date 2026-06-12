// Returns streak count for a habit given its logs and scheduled rest days
// logs: array of { log_date: 'YYYY-MM-DD', done: bool, is_rest_day: bool }
// restDays: array of day-of-week ints (0=Sun) that are scheduled rest days
export function computeStreak(logs, restDays = []) {
  const logMap = {}
  for (const log of logs) {
    logMap[log.log_date] = log
  }

  const today = toDateStr(new Date())
  let streak = 0
  let cursor = new Date()

  while (true) {
    const dateStr = toDateStr(cursor)
    const dayOfWeek = cursor.getDay()
    const log = logMap[dateStr]

    if (dateStr === today && !log) {
      // Today with no log yet — skip, don't penalise
      cursor = prevDay(cursor)
      continue
    }

    if (log && log.is_rest_day) {
      // Explicit rest day logged — skip
      cursor = prevDay(cursor)
      continue
    }

    if (restDays.includes(dayOfWeek)) {
      // Scheduled rest day — skip
      cursor = prevDay(cursor)
      continue
    }

    if (log && log.done) {
      streak++
      cursor = prevDay(cursor)
      continue
    }

    // No log or done=false — stop
    break
  }

  return streak
}

// Returns streak tier string
export function getStreakTier(count) {
  if (count === 0) return 'cold'
  if (count < 7) return 'warm'
  if (count < 30) return 'hot'
  return 'legendary'
}

const MILESTONES = [7, 14, 30, 60, 90, 100, 150, 365]

// Returns { milestone, daysRemaining } or null if past all milestones
export function getNextMilestone(streak) {
  const next = MILESTONES.find(m => m > streak)
  if (!next) return null
  return { milestone: next, daysRemaining: next - streak }
}

// Overall active-day streak: gym satisfied by done=true OR is_rest_day=true OR scheduled Sunday.
// Japanese and DSA must be done=true. Skips today if not yet complete.
export function computeOverallStreak(gymLogs, japaneseLogs, dsaLogs) {
  const gymMap = {}, japMap = {}, dsaMap = {}
  for (const l of gymLogs) gymMap[l.log_date] = l
  for (const l of japaneseLogs) japMap[l.log_date] = l
  for (const l of dsaLogs) dsaMap[l.log_date] = l

  const today = toDateStr(new Date())
  let streak = 0
  let cursor = new Date()

  while (true) {
    const dateStr = toDateStr(cursor)
    const gymLog = gymMap[dateStr]
    const gymOk = gymLog?.done === true || gymLog?.is_rest_day === true || cursor.getDay() === 0
    const japOk = japMap[dateStr]?.done === true
    const dsaOk = dsaMap[dateStr]?.done === true
    const allOk = gymOk && japOk && dsaOk

    if (dateStr === today && !allOk) {
      cursor = prevDay(cursor)
      continue
    }

    if (allOk) {
      streak++
      cursor = prevDay(cursor)
      continue
    }

    break
  }

  return streak
}

// Compute per-subtask streak from allLogs for JapaneseCard
export function computeSubtaskStreak(allLogs, subtaskKey) {
  const today = toDateStr(new Date())
  let streak = 0
  let cursor = new Date()

  while (true) {
    const dateStr = toDateStr(cursor)
    const log = allLogs.find(l => l.log_date === dateStr)

    if (dateStr === today && !log) {
      cursor = prevDay(cursor)
      continue
    }

    const subtaskDone = log?.payload?.subtasks?.[subtaskKey] === true

    if (subtaskDone) {
      streak++
      cursor = prevDay(cursor)
      continue
    }

    break
  }

  return streak
}

function toDateStr(date) {
  return date.toISOString().slice(0, 10)
}

function prevDay(date) {
  const d = new Date(date)
  d.setDate(d.getDate() - 1)
  return d
}
