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
        style={{ backgroundColor: isDone ? '#10b981' : '#F59E0B' }}
      />

      <div className="p-4 pl-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <i className="ti ti-barbell text-amber-500 dark:text-amber-400 text-lg" />
            <span className="font-display font-semibold text-sm text-zinc-900 dark:text-os-fg">Gym</span>
          </div>
          <StreakDisplay count={streak} flash={booped} />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {WORKOUT_TYPES.map(({ key, subtitle }) => {
            const active = selected === key
            return (
              <button
                key={key}
                onClick={() => selectWorkout(key)}
                className="flex flex-col items-start px-3 py-2.5 rounded-lg text-left transition-all duration-150"
                style={active ? {
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.4)',
                  color: '#F59E0B',
                } : {
                  background: 'transparent',
                  border: '1px solid #1C1C2E',
                  color: '#8888A0',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = '#141428'
                    e.currentTarget.style.borderColor = '#2E2E52'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.borderColor = '#1C1C2E'
                  }
                }}
              >
                <span className="text-sm font-body font-medium">{key}</span>
                <span className="text-[11px] font-body mt-0.5" style={{ color: '#4A4A60' }}>{subtitle}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col items-start gap-0.5">
            <button
              onClick={markRest}
              disabled={restLimitReached}
              className="text-xs font-body px-2.5 py-1 rounded transition-colors duration-150"
              style={restLimitReached ? {
                border: '1px solid #1C1C2E',
                color: '#4A4A60',
                cursor: 'not-allowed',
              } : isRest ? {
                border: '1px solid rgba(99,102,241,0.4)',
                color: '#818CF8',
                background: 'rgba(99,102,241,0.08)',
              } : {
                border: '1px solid #2E2E52',
                color: '#8888A0',
              }}
            >
              {restLimitReached ? 'Rest limit reached' : 'Rest day'}
            </button>
            {weekRestCount === 1 && !restLimitReached && (
              <span className="text-[10px] font-body" style={{ color: '#F59E0B' }}>1 of 2 rest days used</span>
            )}
          </div>
          <span
            className="text-xs font-body"
            style={{ color: isDone ? '#10b981' : '#4A4A60' }}
          >
            {isRest ? 'Rest day — streak saved' : selected ? `Done — ${selected}` : 'Select workout'}
          </span>
        </div>
      </div>
    </div>
  )
}
