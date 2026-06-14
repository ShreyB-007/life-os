import { useState, useEffect, forwardRef } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/date'
import { getLocalDateString } from '../lib/dateUtils'
import StreakDisplay from './StreakDisplay'
import WorkoutDrawer from './WorkoutDrawer'
import HistoryDrawer from './HistoryDrawer'

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
  return getLocalDateString(monday)
}

const GymCard = forwardRef(function GymCard({ streak, todayLog, allLogs = [], onLog }, ref) {
  const [selected, setSelected]                  = useState(null)
  const [isRest, setIsRest]                      = useState(false)
  const [saving, setSaving]                      = useState(false)
  const [booped, setBooped]                      = useState(false)
  const [drawerOpen, setDrawerOpen]              = useState(false)
  const [drawerWorkoutType, setDrawerWorkoutType] = useState(null)
  const [drawerFromType, setDrawerFromType]      = useState(null)
  const [historyOpen, setHistoryOpen]            = useState(false)

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
      setDrawerWorkoutType(type)
      setDrawerFromType(null)
      setDrawerOpen(true)
      return
    }

    // Fix 5: derive fromType from todayLog prop directly — avoids any stale state closure
    const currentType = todayLog?.payload?.workout_type
    const fromType = (isDone && !isRest && currentType && currentType !== 'rest') ? currentType : null
    doSelect(type, fromType)
  }

  function doSelect(type, fromType = null) {
    const wasAlreadyDone = isDone
    setSelected(type)
    setIsRest(false)
    save(type, false, true)
    if (!wasAlreadyDone) triggerBoop()
    setDrawerWorkoutType(type)
    setDrawerFromType(fromType)
    setDrawerOpen(true)
  }

  function handleDeleteSession() {
    setSelected(null)
    setIsRest(false)
    save(null, false, false)
    setDrawerOpen(false)
    setDrawerFromType(null)
  }

  // Fix 3: second tap on rest day deselects it
  function markRest() {
    if (isRest) {
      setIsRest(false)
      save(null, false, false)
      return
    }
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

  function openDrawerManually() {
    setDrawerWorkoutType(selected)
    setDrawerFromType(null)
    setDrawerOpen(true)
  }

  function handleDrawerClose() {
    setDrawerOpen(false)
    setDrawerFromType(null)
  }

  return (
    <>
      <div
        ref={ref}
        className={[
          'relative overflow-hidden rounded-xl transition-all duration-200 habit-gym',
          isDone ? 'habit-card-done' : 'habit-card card-interactive',
          booped && isDone ? 'animate-boop' : '',
        ].join(' ')}
      >
        <div className="card-accent-bar" style={{ backgroundColor: isDone ? '#10b981' : '#6366F1' }} />

        <div className="p-4 pl-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <i className="ti ti-barbell text-lg" style={{ color: '#6366F1' }} />
              <span className="font-display font-semibold text-sm text-os-fg">Gym</span>
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
                  className={[
                    'flex flex-col items-start px-3 py-2.5 rounded-lg text-left transition-all',
                    active ? '' : 'gym-type-btn',
                  ].join(' ')}
                  style={active ? {
                    background: 'rgba(99,102,241,0.12)',
                    border: '1px solid rgba(99,102,241,0.45)',
                    color: '#818CF8',
                  } : undefined}
                >
                  <span className="text-sm font-body font-medium">{key}</span>
                  <span className="text-[11px] font-body mt-0.5 text-os-muted">{subtitle}</span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHistoryOpen(true)}
                className="p-1.5 rounded-md text-os-muted hover:text-os-fg transition-colors"
                title="View workout history"
              >
                <i className="ti ti-history text-base" />
              </button>

              <div className="flex flex-col items-start gap-0.5">
                <button
                  onClick={markRest}
                  disabled={restLimitReached && !isRest}
                  className={[
                    'text-xs font-body px-2.5 py-1 rounded gym-rest-btn',
                    restLimitReached && !isRest ? 'is-disabled' : isRest ? 'is-active' : '',
                  ].join(' ')}
                >
                  {restLimitReached && !isRest ? 'Rest limit reached' : 'Rest day'}
                </button>
                {weekRestCount === 1 && !restLimitReached && (
                  <span className="text-[10px] font-body" style={{ color: '#F59E0B' }}>
                    1 of 2 rest days used
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-body" style={{ color: isDone ? '#10b981' : 'var(--os-muted)' }}>
                {isRest ? 'Rest day — streak saved' : selected ? `Done — ${selected}` : 'Select workout'}
              </span>
              {selected && !isRest && (
                <button
                  onClick={openDrawerManually}
                  className="p-1 rounded text-os-muted hover:text-os-fg transition-colors"
                  title="Open workout log"
                >
                  <i className="ti ti-chevron-up text-sm" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {drawerOpen && drawerWorkoutType && (
        <WorkoutDrawer
          key={drawerWorkoutType}
          workoutType={drawerWorkoutType}
          fromType={drawerFromType}
          onClose={handleDrawerClose}
          onDone={handleDrawerClose}
          onDeleteSession={handleDeleteSession}
        />
      )}

      {historyOpen && (
        <HistoryDrawer onClose={() => setHistoryOpen(false)} />
      )}
    </>
  )
})

export default GymCard
