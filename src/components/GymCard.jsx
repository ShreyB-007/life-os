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

export default function GymCard({ streak, todayLog, onLog }) {
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
      }
    }
  }, [todayLog])

  const isDone = selected !== null || isRest

  // Optimistically updates parent logs state, then persists to Supabase.
  async function save(workoutType, restDay) {
    const logEntry = {
      habit_key: 'gym',
      log_date: todayStr(),
      done: true,
      is_rest_day: restDay,
      payload: { workout_type: workoutType },
      logged_at: new Date().toISOString(),
    }
    onLog('gym', logEntry)
    setSaving(true)
    await supabase
      .from('habit_logs')
      .upsert(logEntry, { onConflict: 'habit_key,log_date' })
    setSaving(false)
  }

  function selectWorkout(type) {
    const wasAlreadyDone = isDone
    setSelected(type)
    setIsRest(false)
    save(type, false)
    if (!wasAlreadyDone) triggerBoop()
  }

  function markRest() {
    const wasAlreadyDone = isDone
    setIsRest(true)
    setSelected(null)
    save('rest', true)
    if (!wasAlreadyDone) triggerBoop()
  }

  function triggerBoop() {
    setBooped(false)
    setTimeout(() => setBooped(true), 10)
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <i className="ti ti-barbell text-amber-500 dark:text-amber-400 text-lg" />
          <span className="font-semibold text-sm text-zinc-900 dark:text-gray-100">Gym</span>
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
                  ? 'bg-amber-50 dark:bg-amber-500/20 border-amber-400 dark:border-amber-500 text-amber-700 dark:text-amber-300'
                  : 'border-zinc-200 dark:border-gray-700 text-zinc-700 dark:text-gray-300 hover:border-zinc-400 dark:hover:border-gray-500 hover:bg-zinc-50 dark:hover:bg-gray-800',
              ].join(' ')}
            >
              <span className="text-sm font-medium">{key}</span>
              <span className="text-[11px] text-zinc-400 dark:text-gray-400 mt-0.5">{subtitle}</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={markRest}
          className={[
            'text-xs px-2.5 py-1 rounded border transition-colors duration-150',
            isRest
              ? 'border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10'
              : 'border-zinc-300 dark:border-gray-600 text-zinc-500 dark:text-gray-400 hover:border-zinc-400 dark:hover:border-gray-400',
          ].join(' ')}
        >
          Rest day
        </button>
        <span
          className={[
            'text-xs',
            isDone ? 'text-green-600 dark:text-green-400' : 'text-zinc-400 dark:text-gray-500',
          ].join(' ')}
        >
          {isRest ? 'Rest day — streak saved' : selected ? `Done — ${selected}` : 'Select workout'}
        </span>
      </div>
    </div>
  )
}
