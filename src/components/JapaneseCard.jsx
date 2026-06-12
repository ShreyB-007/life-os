import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/date'
import { computeSubtaskStreak } from '../lib/streaks'
import StreakDisplay from './StreakDisplay'

const SUBTASKS = [
  { key: 'anki', label: 'Anki' },
  { key: 'duolingo', label: 'Duolingo' },
  { key: 'study', label: 'Study session' },
]

export default function JapaneseCard({ streak, todayLog, allLogs, onLog }) {
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
      className={[
        'relative overflow-hidden rounded-xl border transition-all duration-300',
        isDone
          ? 'bg-white dark:bg-void-900 border-emerald-300/40 dark:border-emerald-800/30 ' + (booped ? 'animate-boop' : '')
          : 'bg-white dark:bg-void-900 border-zinc-200 dark:border-void-800 hover:-translate-y-px',
      ].join(' ')}
      style={isDone ? { boxShadow: '0 0 0 1px rgba(16,185,129,0.15), 0 0 28px rgba(16,185,129,0.06)' } : {}}
    >
      {/* Left accent bar */}
      <div
        className="card-accent-bar"
        style={{ backgroundColor: isDone ? '#10b981' : '#3b82f6' }}
      />

      <div className="p-4 pl-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <i className="ti ti-language text-blue-500 dark:text-blue-400 text-lg" />
            <span className="font-display font-semibold text-sm text-zinc-900 dark:text-slate-100">Japanese</span>
          </div>
          <StreakDisplay count={streak} />
        </div>

        <div className="flex flex-col gap-3 mb-4">
          {SUBTASKS.map(({ key, label }) => {
            const subStreak = computeSubtaskStreak(allLogs, key)
            return (
              <div key={key} className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={checked[key]}
                      onChange={() => toggle(key)}
                      className="w-[15px] h-[15px] rounded cursor-pointer"
                    />
                  </div>
                  <span
                    className={[
                      'text-sm font-body transition-colors duration-150',
                      checked[key]
                        ? 'text-zinc-500 dark:text-slate-500 line-through'
                        : 'text-zinc-700 dark:text-slate-300',
                    ].join(' ')}
                  >
                    {label}
                  </span>
                </label>
                <div className="flex items-center gap-1 text-xs text-zinc-400 dark:text-slate-600">
                  {subStreak > 0 ? (
                    <>
                      <i className="ti ti-flame text-amber-500 dark:text-amber-400 text-xs" />
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
            className={[
              'text-xs font-body',
              isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-slate-600',
            ].join(' ')}
          >
            {doneCount} of 3 done
          </span>
        </div>
      </div>
    </div>
  )
}
