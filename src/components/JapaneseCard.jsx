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

export default function JapaneseCard({ streak, todayLog, allLogs, onDone }) {
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
      onDone()
    }
    if (!isDone && prevDone) {
      setPrevDone(false)
    }
  }, [isDone])

  async function toggle(key) {
    const next = { ...checked, [key]: !checked[key] }
    setChecked(next)
    const today = todayStr()
    const newDone = Object.values(next).filter(Boolean).length >= 2
    await supabase.from('habit_logs').upsert(
      {
        habit_key: 'japanese',
        log_date: today,
        done: newDone,
        is_rest_day: false,
        payload: { subtasks: next },
        logged_at: new Date().toISOString(),
      },
      { onConflict: 'habit_key,log_date' }
    )
  }

  return (
    <div
      className={[
        'p-4 rounded-xl border transition-all duration-300',
        isDone
          ? 'border-green-500 bg-green-50 dark:border-green-700 dark:bg-green-950/40 ' + (booped ? 'animate-boop' : '')
          : 'border-zinc-200 bg-white dark:border-gray-800 dark:bg-gray-900',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <i className="ti ti-language text-blue-500 dark:text-blue-400 text-lg" />
          <span className="font-semibold text-sm text-zinc-900 dark:text-gray-100">Japanese</span>
        </div>
        <StreakDisplay count={streak} />
      </div>

      {/* Subtasks */}
      <div className="flex flex-col gap-2.5 mb-4">
        {SUBTASKS.map(({ key, label }) => {
          const subStreak = computeSubtaskStreak(allLogs, key)
          return (
            <div key={key} className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked[key]}
                  onChange={() => toggle(key)}
                  className="w-[15px] h-[15px] rounded accent-blue-500 cursor-pointer"
                />
                <span className="text-sm text-zinc-700 dark:text-gray-300">{label}</span>
              </label>
              <div className="flex items-center gap-1 text-xs text-zinc-400 dark:text-gray-500">
                {subStreak > 0 ? (
                  <>
                    <i className="ti ti-flame text-amber-500 dark:text-amber-400 text-xs" />
                    <span>{subStreak}</span>
                  </>
                ) : (
                  <span>—</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="flex justify-end">
        <span
          className={[
            'text-xs',
            isDone ? 'text-green-600 dark:text-green-400' : 'text-zinc-400 dark:text-gray-500',
          ].join(' ')}
        >
          {doneCount} of 3 done
        </span>
      </div>
    </div>
  )
}
