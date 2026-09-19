import { useState, useEffect, useRef, forwardRef } from 'react'
import { supabase } from '../lib/supabase'
import StreakDisplay from './StreakDisplay'
import DSAProgressGraph from './DSAProgressGraph'

const DIFFICULTIES = [
  { key: 'easy', label: 'Easy', color: '#10B981' },
  { key: 'med',  label: 'Med',  color: '#F59E0B' },
  { key: 'hard', label: 'Hard', color: '#EF4444' },
]

const DSACard = forwardRef(function DSACard({ streak, todayLog, allLogs = [], selectedDate, onLog }, ref) {
  const [counts, setCounts] = useState({ easy: 0, med: 0, hard: 0 })
  const [prevDone, setPrevDone] = useState(false)
  const [booped, setBooped] = useState(false)
  const [showGraph, setShowGraph] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const countsRef = useRef(counts)

  useEffect(() => {
    if (todayLog?.payload) {
      const { easy = 0, med = 0, hard = 0 } = todayLog.payload
      const loaded = { easy, med, hard }
      setCounts(loaded)
      countsRef.current = loaded
    } else {
      const empty = { easy: 0, med: 0, hard: 0 }
      setCounts(empty)
      countsRef.current = empty
    }
  }, [todayLog, selectedDate])

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

  async function saveCounts(next) {
    const totalQuestions = next.easy + next.med + next.hard
    const logEntry = {
      habit_key: 'dsa',
      log_date: selectedDate,
      done: totalQuestions > 0,
      is_rest_day: false,
      payload: { easy: next.easy, med: next.med, hard: next.hard },
      logged_at: new Date().toISOString(),
    }

    onLog('dsa', logEntry)

    const { error } = await supabase
      .from('habit_logs')
      .upsert(logEntry, { onConflict: 'habit_key,log_date' })

    if (error) {
      const { easy = 0, med = 0, hard = 0 } = todayLog?.payload ?? {}
      const reverted = { easy, med, hard }
      countsRef.current = reverted
      setCounts(reverted)
      onLog('dsa', todayLog ?? { habit_key: 'dsa', log_date: selectedDate, done: false, is_rest_day: false, payload: {} })
      setSaveError(true)
      setTimeout(() => setSaveError(false), 4000)
    }
  }

  function adjust(key, delta) {
    const prev = countsRef.current
    const next = { ...prev, [key]: Math.max(0, prev[key] + delta) }
    countsRef.current = next
    setCounts(next)
    saveCounts(next)
  }

  return (
    <>
    <div
      ref={ref}
      className={[
        'relative overflow-hidden rounded-xl transition-all duration-200 habit-dsa',
        isDone ? 'habit-card-done' : 'habit-card card-interactive',
        booped && isDone ? 'animate-boop' : '',
      ].join(' ')}
    >
      {/* Left accent bar */}
      <div
        className="card-accent-bar"
        style={{ backgroundColor: isDone ? '#10b981' : '#06B6D4' }}
      />

      <div className="p-4 pl-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <i className="ti ti-code text-lg" style={{ color: '#06B6D4' }} />
            <span className="font-display font-semibold text-sm text-os-fg">DSA</span>
            <button
              onClick={e => { e.stopPropagation(); setShowGraph(true) }}
              className="action-pill-btn action-pill-emerald"
              title="View progress"
            >
              <i className="ti ti-chart-line" />
            </button>
          </div>
          <StreakDisplay count={streak} flash={booped} />
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
                  className="w-7 h-7 rounded font-mono text-sm flex items-center justify-center counter-btn"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-mono font-medium tabular-nums text-os-fg">
                  {counts[key]}
                </span>
                <button
                  onClick={() => adjust(key, 1)}
                  className="w-7 h-7 rounded font-mono text-sm flex items-center justify-center counter-btn"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <span
            className="text-xs font-body"
            style={{ color: isDone ? '#10b981' : 'var(--os-muted)' }}
          >
            {isDone ? `${counts.easy}E · ${counts.med}M · ${counts.hard}H solved` : 'Not started'}
          </span>
        </div>

        {saveError && (
          <p className="mt-2 text-[11px] font-body" style={{ color: '#EF4444' }}>
            Couldn't save — check your connection and try again.
          </p>
        )}
      </div>
    </div>

    {showGraph && (
      <DSAProgressGraph allLogs={allLogs} onClose={() => setShowGraph(false)} />
    )}
    </>
  )
})

export default DSACard
