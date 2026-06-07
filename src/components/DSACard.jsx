import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/date'
import StreakDisplay from './StreakDisplay'

const DIFFICULTIES = [
  { key: 'easy', label: 'Easy', className: 'text-green-600 dark:text-green-500' },
  { key: 'med',  label: 'Med',  className: 'text-amber-600 dark:text-amber-500' },
  { key: 'hard', label: 'Hard', className: 'text-red-600 dark:text-red-500' },
]

export default function DSACard({ streak, todayLog, onDone }) {
  const [counts, setCounts] = useState({ easy: 0, med: 0, hard: 0 })
  const [prevDone, setPrevDone] = useState(false)
  const [booped, setBooped] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    if (todayLog?.payload) {
      const { easy = 0, med = 0, hard = 0 } = todayLog.payload
      setCounts({ easy, med, hard })
    }
  }, [todayLog])

  const total = counts.easy + counts.med + counts.hard
  const isDone = total > 0

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

  function adjust(key, delta) {
    setCounts(prev => {
      const next = { ...prev, [key]: Math.max(0, prev[key] + delta) }
      scheduleSave(next)
      return next
    })
  }

  function scheduleSave(nextCounts) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const newTotal = nextCounts.easy + nextCounts.med + nextCounts.hard
      supabase.from('habit_logs').upsert(
        {
          habit_key: 'dsa',
          log_date: todayStr(),
          done: newTotal > 0,
          is_rest_day: false,
          payload: nextCounts,
          logged_at: new Date().toISOString(),
        },
        { onConflict: 'habit_key,log_date' }
      )
    }, 1000)
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
          <i className="ti ti-code text-purple-500 dark:text-purple-400 text-lg" />
          <span className="font-semibold text-sm text-zinc-900 dark:text-gray-100">DSA</span>
        </div>
        <StreakDisplay count={isDone ? streak : 0} />
      </div>

      {/* Counter rows */}
      <div className="flex flex-col gap-3 mb-4">
        {DIFFICULTIES.map(({ key, label, className }) => (
          <div key={key} className="flex items-center justify-between">
            <span className={`text-sm font-medium w-12 ${className}`}>
              {label}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => adjust(key, -1)}
                className="w-7 h-7 rounded border border-zinc-200 dark:border-gray-700 text-zinc-600 dark:text-gray-300 hover:border-zinc-400 dark:hover:border-gray-500 hover:bg-zinc-50 dark:hover:bg-gray-800 transition-colors text-sm flex items-center justify-center"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                {counts[key]}
              </span>
              <button
                onClick={() => adjust(key, 1)}
                className="w-7 h-7 rounded border border-zinc-200 dark:border-gray-700 text-zinc-600 dark:text-gray-300 hover:border-zinc-400 dark:hover:border-gray-500 hover:bg-zinc-50 dark:hover:bg-gray-800 transition-colors text-sm flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex justify-end">
        <span
          className={[
            'text-xs',
            isDone ? 'text-green-600 dark:text-green-400' : 'text-zinc-400 dark:text-gray-500',
          ].join(' ')}
        >
          {isDone
            ? `${counts.easy}E · ${counts.med}M · ${counts.hard}H solved`
            : 'Not started'}
        </span>
      </div>
    </div>
  )
}
