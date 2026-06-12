import { useState, useEffect, useRef, forwardRef } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/date'
import StreakDisplay from './StreakDisplay'

const DIFFICULTIES = [
  { key: 'easy', label: 'Easy', color: '#10B981' },
  { key: 'med',  label: 'Med',  color: '#F59E0B' },
  { key: 'hard', label: 'Hard', color: '#EF4444' },
]

const DSACard = forwardRef(function DSACard({ streak, todayLog, onLog }, ref) {
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
      ref={ref}
      className={[
        'relative overflow-hidden rounded-xl transition-all duration-200',
        isDone ? '' : 'card-interactive',
        booped && isDone ? 'animate-boop' : '',
      ].join(' ')}
      style={isDone ? {
        background: 'rgba(16,185,129,0.06)',
        border: '1px solid rgba(16,185,129,0.25)',
        borderTop: '1px solid rgba(16,185,129,0.5)',
        boxShadow: '0 0 20px rgba(16,185,129,0.06) inset',
      } : {
        background: '#0F0F1A',
        border: '1px solid #1C1C2E',
      }}
    >
      {/* Left accent bar */}
      <div
        className="card-accent-bar"
        style={{ backgroundColor: isDone ? '#10b981' : '#8B5CF6' }}
      />

      <div className="p-4 pl-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <i className="ti ti-code text-violet-400 text-lg" />
            <span className="font-display font-semibold text-sm text-zinc-900 dark:text-os-fg">DSA</span>
          </div>
          <StreakDisplay count={isDone ? streak : 0} flash={booped} />
        </div>

        <div className="flex flex-col gap-3 mb-4">
          {DIFFICULTIES.map(({ key, label, color }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm font-body font-semibold w-10" style={{ color }}>
                {label}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => adjust(key, -1)}
                  className="w-7 h-7 rounded font-mono text-sm flex items-center justify-center transition-all duration-150"
                  style={{ border: '1px solid #1C1C2E', color: '#8888A0' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#2E2E52'; e.currentTarget.style.background = '#141428' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#1C1C2E'; e.currentTarget.style.background = 'transparent' }}
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-mono font-medium tabular-nums dark:text-os-fg">
                  {counts[key]}
                </span>
                <button
                  onClick={() => adjust(key, 1)}
                  className="w-7 h-7 rounded font-mono text-sm flex items-center justify-center transition-all duration-150"
                  style={{ border: '1px solid #1C1C2E', color: '#8888A0' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#2E2E52'; e.currentTarget.style.background = '#141428' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#1C1C2E'; e.currentTarget.style.background = 'transparent' }}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <span className="text-xs font-body" style={{ color: isDone ? '#10b981' : '#4A4A60' }}>
            {isDone ? `${counts.easy}E · ${counts.med}M · ${counts.hard}H solved` : 'Not started'}
          </span>
        </div>
      </div>
    </div>
  )
})

export default DSACard
