import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/date'
import StreakDisplay from './StreakDisplay'

const DIFFICULTIES = [
  { key: 'easy', label: 'Easy', color: '#22c55e', darkColor: '#4ade80' },
  { key: 'med',  label: 'Med',  color: '#f59e0b', darkColor: '#fbbf24' },
  { key: 'hard', label: 'Hard', color: '#ef4444', darkColor: '#f87171' },
]

export default function DSACard({ streak, todayLog, onLog }) {
  const [counts, setCounts] = useState({ easy: 0, med: 0, hard: 0 })
  const [prevDone, setPrevDone] = useState(false)
  const [booped, setBooped] = useState(false)
  const saveTimer = useRef(null)
  const countsRef = useRef(counts)

  useEffect(() => {
    if (todayLog?.payload) {
      const { easy = 0, med = 0, hard = 0 } = todayLog.payload
      const loaded = { easy, med, hard }
      setCounts(loaded)
      countsRef.current = loaded
    }
  }, [todayLog])

  const total = counts.easy + counts.med + counts.hard
  const isDone = total > 0

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

  function adjust(key, delta) {
    const prev = countsRef.current
    const next = { ...prev, [key]: Math.max(0, prev[key] + delta) }
    countsRef.current = next
    setCounts(next)

    const newTotal = next.easy + next.med + next.hard
    const logEntry = {
      habit_key: 'dsa',
      log_date: todayStr(),
      done: newTotal > 0,
      is_rest_day: false,
      payload: next,
      logged_at: new Date().toISOString(),
    }
    onLog('dsa', logEntry)

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      supabase.from('habit_logs').upsert(logEntry, { onConflict: 'habit_key,log_date' })
    }, 1000)
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
        style={{ backgroundColor: isDone ? '#10b981' : '#a855f7' }}
      />

      <div className="p-4 pl-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <i className="ti ti-code text-purple-500 dark:text-purple-400 text-lg" />
            <span className="font-display font-semibold text-sm text-zinc-900 dark:text-slate-100">DSA</span>
          </div>
          <StreakDisplay count={isDone ? streak : 0} />
        </div>

        <div className="flex flex-col gap-3 mb-4">
          {DIFFICULTIES.map(({ key, label, color, darkColor }) => (
            <div key={key} className="flex items-center justify-between">
              <span
                className="text-sm font-body font-semibold w-10"
                style={{ color }}
              >
                {label}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => adjust(key, -1)}
                  className="w-7 h-7 rounded border border-zinc-200 dark:border-void-750 text-zinc-500 dark:text-slate-500 hover:border-zinc-300 dark:hover:border-void-700 hover:bg-zinc-50 dark:hover:bg-void-800 transition-colors text-sm font-mono flex items-center justify-center"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-mono font-medium tabular-nums text-zinc-900 dark:text-slate-200">
                  {counts[key]}
                </span>
                <button
                  onClick={() => adjust(key, 1)}
                  className="w-7 h-7 rounded border border-zinc-200 dark:border-void-750 text-zinc-500 dark:text-slate-500 hover:border-zinc-300 dark:hover:border-void-700 hover:bg-zinc-50 dark:hover:bg-void-800 transition-colors text-sm font-mono flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <span
            className={[
              'text-xs font-body',
              isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-slate-600',
            ].join(' ')}
          >
            {isDone ? `${counts.easy}E · ${counts.med}M · ${counts.hard}H solved` : 'Not started'}
          </span>
        </div>
      </div>
    </div>
  )
}
