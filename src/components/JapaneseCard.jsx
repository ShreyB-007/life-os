import { useState, useEffect, forwardRef } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/date'
import { computeSubtaskStreak } from '../lib/streaks'
import StreakDisplay from './StreakDisplay'

const SUBTASKS = [
  { key: 'anki', label: 'Anki' },
  { key: 'duolingo', label: 'Duolingo' },
  { key: 'study', label: 'Study session' },
]

const JapaneseCard = forwardRef(function JapaneseCard({ streak, todayLog, allLogs, onLog }, ref) {
  const [checked, setChecked] = useState({ anki: false, duolingo: false, study: false })
  const [prevDone, setPrevDone] = useState(false)
  const [booped, setBooped] = useState(false)

  useEffect(() => {
    if (todayLog?.payload?.subtasks) {
      setChecked(todayLog.payload.subtasks)
    }
  }, [todayLog])

  const doneCount = Object.values(checked).filter(Boolean).length
  const isDone = doneCount >= 2

  useEffect(() => {
    if (isDone && !prevDone) {
      setPrevDone(true)
      setBooped(false)
      setTimeout(() => setBooped(true), 10)
    }
    if (!isDone && prevDone) {
      setPrevDone(false)
    }
  }, [isDone])

  async function toggle(key) {
    const next = { ...checked, [key]: !checked[key] }
    setChecked(next)
    const newDone = Object.values(next).filter(Boolean).length >= 2
    const logEntry = {
      habit_key: 'japanese',
      log_date: todayStr(),
      done: newDone,
      is_rest_day: false,
      payload: { subtasks: next },
      logged_at: new Date().toISOString(),
    }
    onLog('japanese', logEntry)
    await supabase.from('habit_logs').upsert(logEntry, { onConflict: 'habit_key,log_date' })
  }

  return (
    <div
      ref={ref}
      className={[
        'relative overflow-hidden rounded-xl transition-all duration-200',
        isDone ? 'habit-card-done' : 'habit-card card-interactive',
        booped && isDone ? 'animate-boop' : '',
      ].join(' ')}
    >
      {/* Left accent bar */}
      <div
        className="card-accent-bar"
        style={{ backgroundColor: isDone ? '#10b981' : '#6366F1' }}
      />

      <div className="p-4 pl-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <i className="ti ti-language text-indigo-400 text-lg" />
            <span className="font-display font-semibold text-sm text-os-fg">Japanese</span>
          </div>
          <StreakDisplay count={streak} flash={booped} />
        </div>

        <div className="flex flex-col gap-3 mb-4">
          {SUBTASKS.map(({ key, label }) => {
            const subStreak = computeSubtaskStreak(allLogs, key)
            return (
              <div key={key} className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked[key]}
                    onChange={() => toggle(key)}
                    className="w-[15px] h-[15px] rounded cursor-pointer"
                  />
                  <span
                    className="text-sm font-body transition-colors duration-150"
                    style={{
                      color: checked[key] ? 'var(--os-muted)' : 'var(--os-secondary)',
                      textDecoration: checked[key] ? 'line-through' : 'none',
                    }}
                  >
                    {label}
                  </span>
                </label>
                <div className="flex items-center gap-1 text-xs text-os-muted">
                  {subStreak > 0 ? (
                    <>
                      <i className="ti ti-flame text-xs" style={{ color: '#F59E0B' }} />
                      <span className="font-mono">{subStreak}</span>
                    </>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end">
          <span
            className="text-xs font-body"
            style={{ color: isDone ? '#10b981' : 'var(--os-muted)' }}
          >
            {doneCount} of 3 done
          </span>
        </div>
      </div>
    </div>
  )
})

export default JapaneseCard
