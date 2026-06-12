import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/date'
import StreakDisplay from './StreakDisplay'

const WORKOUT_TYPES = [
  { key: 'Push', subtitle: 'Chest · Sho · Tri' },
  { key: 'Pull', subtitle: 'Back · Biceps' },
  { key: 'Legs', subtitle: 'Legs · Abs' },
  { key: 'Cardio', subtitle: 'Endurance' },
]

function getMondayStr() {
  const today = new Date()
  const daysToMonday = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - daysToMonday)
  return monday.toISOString().slice(0, 10)
}

export default function GymCard({ streak, todayLog, allLogs = [], onLog }) {
  const [selected, setSelected] = useState(null)
  const [isRest, setIsRest] = useState(false)
  const [saving, setSaving] = useState(false)
  const [booped, setBooped] = useState(false)

  useEffect(() => {
    if (todayLog) {
      const wt = todayLog.payload?.workout_type
      if (wt === 'rest') {
        setIsRest(true)
        setSelected(null)
      } else if (wt) {
        setSelected(wt)
        setIsRest(false)
      } else if (!todayLog.done) {
        setSelected(null)
        setIsRest(false)
      }
    } else {
      setSelected(null)
      setIsRest(false)
    }
  }, [todayLog])

  const isDone = selected !== null || isRest

  const mondayStr = getMondayStr()
  const weekRestCount = allLogs.filter(l => l.is_rest_day && l.log_date >= mondayStr).length
  const restLimitReached = weekRestCount >= 2

  async function save(workoutType, restDay, done) {
    const logEntry = {
      habit_key: 'gym',
      log_date: todayStr(),
      done,
      is_rest_day: restDay,
      payload: workoutType ? { workout_type: workoutType } : {},
      logged_at: new Date().toISOString(),
    }
    onLog('gym', logEntry)
    setSaving(true)
    await supabase.from('habit_logs').upsert(logEntry, { onConflict: 'habit_key,log_date' })
    setSaving(false)
  }

  function selectWorkout(type) {
    if (selected === type) {
      setSelected(null)
      setIsRest(false)
      save(null, false, false)
      return
    }
    const wasAlreadyDone = isDone
    setSelected(type)
    setIsRest(false)
    save(type, false, true)
    if (!wasAlreadyDone) triggerBoop()
  }

  function markRest() {
    if (restLimitReached) return
    const wasAlreadyDone = isDone
    setIsRest(true)
    setSelected(null)
    save('rest', true, true)
    if (!wasAlreadyDone) triggerBoop()
  }

  function triggerBoop() {
    setBooped(false)
    setTimeout(() => setBooped(true), 10)
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
        style={{ backgroundColor: isDone ? '#10b981' : '#f59e0b' }}
      />

      <div className="p-4 pl-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <i className="ti ti-barbell text-amber-500 dark:text-amber-400 text-lg" />
            <span className="font-display font-semibold text-sm text-zinc-900 dark:text-slate-100">Gym</span>
          </div>
          <StreakDisplay count={streak} />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {WORKOUT_TYPES.map(({ key, subtitle }) => {
            const active = selected === key
            return (
              <button
                key={key}
                onClick={() => selectWorkout(key)}
                className={[
                  'flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all duration-150',
                  active
                    ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-400/60 dark:border-amber-500/50 text-amber-700 dark:text-amber-300'
                    : 'border-zinc-200 dark:border-void-750 text-zinc-600 dark:text-slate-400 hover:border-zinc-300 dark:hover:border-void-700 hover:bg-zinc-50 dark:hover:bg-void-800',
                ].join(' ')}
              >
                <span className="text-sm font-body font-medium">{key}</span>
                <span className="text-[11px] font-body text-zinc-400 dark:text-slate-600 mt-0.5">{subtitle}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col items-start gap-0.5">
            <button
              onClick={markRest}
              disabled={restLimitReached}
              className={[
                'text-xs font-body px-2.5 py-1 rounded border transition-colors duration-150',
                restLimitReached
                  ? 'border-zinc-200 dark:border-void-750 text-zinc-300 dark:text-slate-700 bg-zinc-50 dark:bg-void-850 cursor-not-allowed'
                  : isRest
                    ? 'border-blue-400/60 dark:border-blue-500/50 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10'
                    : 'border-zinc-300 dark:border-void-700 text-zinc-500 dark:text-slate-500 hover:border-zinc-400 dark:hover:border-void-600',
              ].join(' ')}
            >
              {restLimitReached ? 'Rest limit reached' : 'Rest day'}
            </button>
            {weekRestCount === 1 && !restLimitReached && (
              <span className="text-[10px] font-body text-amber-500 dark:text-amber-400">1 of 2 rest days used</span>
            )}
          </div>
          <span
            className={[
              'text-xs font-body',
              isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-slate-600',
            ].join(' ')}
          >
            {isRest ? 'Rest day — streak saved' : selected ? `Done — ${selected}` : 'Select workout'}
          </span>
        </div>
      </div>
    </div>
  )
}
