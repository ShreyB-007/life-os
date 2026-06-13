import { useState, useEffect, forwardRef } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/date'
import StreakDisplay from './StreakDisplay'
import WorkoutDrawer from './WorkoutDrawer'

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

const GymCard = forwardRef(function GymCard({ streak, todayLog, allLogs = [], onLog }, ref) {
  const [selected, setSelected]           = useState(null)
  const [isRest, setIsRest]               = useState(false)
  const [saving, setSaving]               = useState(false)
  const [booped, setBooped]               = useState(false)
  const [drawerOpen, setDrawerOpen]       = useState(false)
  const [drawerWorkoutType, setDrawerWorkoutType] = useState(null)
  const [checking, setChecking]           = useState(false)
  const [pendingDeselect, setPendingDeselect] = useState(null)  // { type, logs }
  const [pendingSwitch, setPendingSwitch]     = useState(null)  // { fromType, toType, logs }

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

  async function fetchTodayLogsForType(workoutType) {
    const { data: exs } = await supabase
      .from('exercises')
      .select('id')
      .contains('workout_type_tags', [workoutType])
    if (!exs?.length) return []
    const ids = exs.map(e => e.id)
    const { data: logs } = await supabase
      .from('exercise_logs')
      .select('id, exercise_id')
      .in('exercise_id', ids)
      .eq('log_date', todayStr())
    return logs || []
  }

  async function selectWorkout(type) {
    if (checking) return

    if (selected === type) {
      // Deselect: tapping active type again
      setChecking(true)
      const logs = await fetchTodayLogsForType(type)
      setChecking(false)
      if (logs.length > 0) {
        setPendingDeselect({ type, logs })
      } else {
        doDeselect()
      }
      return
    }

    if (selected !== null) {
      // Switch to a different type while one is already selected
      setChecking(true)
      const logs = await fetchTodayLogsForType(selected)
      setChecking(false)
      if (logs.length > 0) {
        setPendingSwitch({ fromType: selected, toType: type, logs })
        return
      }
    }

    // Fresh selection or silent switch (no exercise logs yet)
    doSelect(type)
  }

  function doDeselect() {
    setSelected(null)
    setIsRest(false)
    save(null, false, false)
    setDrawerOpen(false)
    setPendingDeselect(null)
  }

  function doSelect(type) {
    const wasAlreadyDone = isDone
    setSelected(type)
    setIsRest(false)
    save(type, false, true)
    if (!wasAlreadyDone) triggerBoop()
    setDrawerWorkoutType(type)
    setDrawerOpen(true)
  }

  async function confirmDeselect() {
    const ids = pendingDeselect.logs.map(l => l.id)
    if (ids.length) await supabase.from('exercise_logs').delete().in('id', ids)
    doDeselect()
  }

  async function confirmSwitch() {
    const { fromType, toType, logs } = pendingSwitch

    for (const log of logs) {
      const { data: exercise } = await supabase
        .from('exercises')
        .select('id, normalized_name, workout_type_tags')
        .eq('id', log.exercise_id)
        .single()
      if (!exercise) continue

      const tags = exercise.workout_type_tags || []
      if (tags.includes(toType)) continue

      // Check if another exercise with the same normalized name already exists in the new type
      const { data: match } = await supabase
        .from('exercises')
        .select('id')
        .eq('normalized_name', exercise.normalized_name)
        .contains('workout_type_tags', [toType])
        .maybeSingle()

      if (match) {
        // Re-point the log to the existing exercise in the new type
        await supabase.from('exercise_logs').update({ exercise_id: match.id }).eq('id', log.id)
      } else {
        // Add the new type tag so this exercise appears in the new drawer
        await supabase.from('exercises').update({ workout_type_tags: [...tags, toType] }).eq('id', exercise.id)
      }
    }

    setPendingSwitch(null)
    doSelect(pendingSwitch.toType)
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

  function openDrawerManually() {
    setDrawerWorkoutType(selected)
    setDrawerOpen(true)
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
                  disabled={checking}
                  className={[
                    'flex flex-col items-start px-3 py-2.5 rounded-lg text-left transition-all',
                    active ? '' : 'gym-type-btn',
                    checking ? 'opacity-60 cursor-wait' : '',
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
            <div className="flex flex-col items-start gap-0.5">
              <button
                onClick={markRest}
                disabled={restLimitReached}
                className={[
                  'text-xs font-body px-2.5 py-1 rounded gym-rest-btn',
                  restLimitReached ? 'is-disabled' : isRest ? 'is-active' : '',
                ].join(' ')}
              >
                {restLimitReached ? 'Rest limit reached' : 'Rest day'}
              </button>
              {weekRestCount === 1 && !restLimitReached && (
                <span className="text-[10px] font-body" style={{ color: '#F59E0B' }}>
                  1 of 2 rest days used
                </span>
              )}
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
          onClose={() => setDrawerOpen(false)}
          onDone={() => setDrawerOpen(false)}
        />
      )}

      {/* Deselect confirmation modal */}
      {pendingDeselect && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            style={{ zIndex: 160 }}
            onClick={() => setPendingDeselect(null)}
          />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 w-full max-w-sm mx-4"
            style={{ zIndex: 161, background: 'var(--drawer-bg)', border: '1px solid var(--drawer-card-border)' }}
          >
            <h3 className="font-display font-semibold text-sm text-os-fg mb-2">
              Remove {pendingDeselect.type} day?
            </h3>
            <p className="text-sm font-body text-os-secondary mb-5">
              You've already logged {pendingDeselect.logs.length} exercise{pendingDeselect.logs.length !== 1 ? 's' : ''} for today's {pendingDeselect.type} session. Deselecting will permanently delete today's workout log. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingDeselect(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-body font-medium text-os-secondary transition-colors hover:text-os-fg"
                style={{ border: '1px solid var(--drawer-card-border)' }}
              >
                Keep it
              </button>
              <button
                onClick={confirmDeselect}
                className="flex-1 py-2.5 rounded-lg text-sm font-body font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: '#EF4444' }}
              >
                Delete and deselect
              </button>
            </div>
          </div>
        </>
      )}

      {/* Switch confirmation modal */}
      {pendingSwitch && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            style={{ zIndex: 160 }}
            onClick={() => setPendingSwitch(null)}
          />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 w-full max-w-sm mx-4"
            style={{ zIndex: 161, background: 'var(--drawer-bg)', border: '1px solid var(--drawer-card-border)' }}
          >
            <h3 className="font-display font-semibold text-sm text-os-fg mb-2">
              Switch to {pendingSwitch.toType} day?
            </h3>
            <p className="text-sm font-body text-os-secondary mb-5">
              You've logged {pendingSwitch.logs.length} exercise{pendingSwitch.logs.length !== 1 ? 's' : ''} for {pendingSwitch.fromType} today. Your {pendingSwitch.fromType} log will be automatically moved to {pendingSwitch.toType}. You can move it back any time by switching again.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingSwitch(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-body font-medium text-os-secondary transition-colors hover:text-os-fg"
                style={{ border: '1px solid var(--drawer-card-border)' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmSwitch}
                className="flex-1 py-2.5 rounded-lg text-sm font-body font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: '#6366F1' }}
              >
                Switch and move data
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
})

export default GymCard
