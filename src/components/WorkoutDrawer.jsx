import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/date'
import { normalizeExerciseName } from '../lib/exercise'
import ExerciseCard from './ExerciseCard'
import AddExerciseModal from './AddExerciseModal'
import DeleteConfirmModal from './DeleteConfirmModal'
import ProgressGraph from './ProgressGraph'

const WORKOUT_EMOJIS = { Push: '💪', Pull: '🏋️', Legs: '🦵', Cardio: '🏃' }

export default function WorkoutDrawer({ workoutType, fromType, viewOnly, onClose, onDone, onDeleteSession, onTransferComplete }) {
  const [exercises, setExercises]             = useState([])
  const [logs, setLogs]                       = useState({})
  const [loading, setLoading]                 = useState(true)
  const [expandedId, setExpandedId]           = useState(null)
  const [showAdd, setShowAdd]                 = useState(false)
  const [graphExercise, setGraphExercise]     = useState(null)
  const [deleteTarget, setDeleteTarget]       = useState(null)
  const [toast, setToast]                     = useState(null)
  const [showTransferBanner, setShowTransferBanner] = useState(false)
  const [transferring, setTransferring]       = useState(false)
  const [deletingSession, setDeletingSession] = useState(false)
  const [cursor, setCursor]                   = useState({ x: 200, y: 200 })

  const drawerRef = useRef(null)

  useEffect(() => { fetchData() }, [workoutType])

  useEffect(() => {
    if (fromType) checkForTransfer()
  }, [fromType])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: exs } = await supabase
      .from('exercises')
      .select('*')
      .contains('workout_type_tags', [workoutType])
      .order('created_at')

    if (!exs) { setLoading(false); return }
    setExercises(exs)

    const ids = exs.map(e => e.id)
    if (ids.length > 0) {
      const { data: logData } = await supabase
        .from('exercise_logs')
        .select('*')
        .in('exercise_id', ids)
        .order('log_date', { ascending: false })

      const map = {}
      for (const ex of exs) map[ex.id] = []
      for (const l of (logData || [])) map[l.exercise_id].push(l)
      setLogs(map)
    } else {
      setLogs({})
    }
    setLoading(false)
  }

  async function checkForTransfer() {
    const today = todayStr()
    const { data: fromExs } = await supabase
      .from('exercises')
      .select('id')
      .contains('workout_type_tags', [fromType])
    if (!fromExs?.length) return

    const { data: fromLogs } = await supabase
      .from('exercise_logs')
      .select('id')
      .in('exercise_id', fromExs.map(e => e.id))
      .eq('log_date', today)

    if (fromLogs?.length) setShowTransferBanner(true)
  }

  async function handleTransfer() {
    setTransferring(true)
    const today = todayStr()

    try {
      // Fetch source exercises and today's logs with full data
      const { data: fromExs } = await supabase
        .from('exercises')
        .select('id, normalized_name, workout_type_tags, primary_workout_type, weight_type')
        .contains('workout_type_tags', [fromType])

      if (!fromExs?.length) { setShowTransferBanner(false); return }

      const { data: fromLogs } = await supabase
        .from('exercise_logs')
        .select('*')
        .in('exercise_id', fromExs.map(e => e.id))
        .eq('log_date', today)

      if (!fromLogs?.length) { setShowTransferBanner(false); return }

      // Step 1: For each source log, find/create the target exercise and copy the log there
      // if it maps to a different exercise. Track which source logs were moved.
      const movedLogIds = []

      for (const log of fromLogs) {
        const srcEx = fromExs.find(e => e.id === log.exercise_id)
        if (!srcEx) continue

        const srcTags = srcEx.workout_type_tags || []

        if (srcTags.includes(workoutType)) {
          // Exercise already has the target tag — log stays on this exercise.
          // Source tag cleanup (step 3) will remove the source tag if no prior history.
          continue
        }

        // Find a matching exercise already in the target type
        const { data: match } = await supabase
          .from('exercises').select('id')
          .eq('normalized_name', srcEx.normalized_name)
          .contains('workout_type_tags', [workoutType])
          .maybeSingle()

        if (match) {
          // Copy log to the existing target exercise
          const { error: upsertErr } = await supabase.from('exercise_logs').upsert({
            exercise_id: match.id,
            log_date: log.log_date,
            sets: log.sets,
            logged_at: log.logged_at,
          }, { onConflict: 'exercise_id,log_date' })
          if (upsertErr) throw upsertErr
          movedLogIds.push(log.id)
        } else {
          // No matching target exercise — add target tag to this exercise.
          // Source tag cleanup (step 3) will remove the source tag if no prior history.
          await supabase.from('exercises')
            .update({ workout_type_tags: [...srcTags, workoutType] })
            .eq('id', srcEx.id)
        }
      }

      // Step 2: Delete source logs that were copied to a different exercise
      if (movedLogIds.length > 0) {
        const { error: deleteErr } = await supabase
          .from('exercise_logs').delete().in('id', movedLogIds)
        if (deleteErr) throw deleteErr
      }

      // Step 3: Remove source type tag from exercises that have no prior history there
      for (const srcEx of fromExs) {
        const srcTags = srcEx.workout_type_tags || []
        if (!srcTags.includes(fromType)) continue

        const { data: priorLogs } = await supabase
          .from('exercise_logs').select('id')
          .eq('exercise_id', srcEx.id)
          .lt('log_date', today)
          .limit(1)

        if (!priorLogs?.length) {
          const cleanedTags = srcTags.filter(t => t !== fromType)
          if (cleanedTags.length === 0) {
            await supabase.from('exercises').update({
              workout_type_tags: [workoutType],
              primary_workout_type: workoutType,
            }).eq('id', srcEx.id)
          } else {
            await supabase.from('exercises').update({ workout_type_tags: cleanedTags }).eq('id', srcEx.id)
          }
        }
      }

      // Step 4: Update habit_log to reflect the new active workout type
      await supabase.from('habit_logs').upsert({
        habit_key: 'gym',
        log_date: today,
        done: true,
        is_rest_day: false,
        payload: { workout_type: workoutType },
        logged_at: new Date().toISOString(),
      }, { onConflict: 'habit_key,log_date' })

      setShowTransferBanner(false)
      await fetchData()
      showToast(`Session transferred from ${fromType}`)
      onTransferComplete?.(workoutType)

    } catch {
      showToast('Transfer failed — please try again')
    } finally {
      setTransferring(false)
    }
  }

  function handleLogSave(exerciseId, entry) {
    setLogs(prev => ({
      ...prev,
      [exerciseId]: [entry, ...(prev[exerciseId] || []).filter(l => l.log_date !== entry.log_date)],
    }))
  }

  async function handleAdd(name, weightType) {
    const normalized = normalizeExerciseName(name)
    const { data: existing } = await supabase
      .from('exercises')
      .select('name')
      .eq('normalized_name', normalized)
      .maybeSingle()
    if (existing) return `duplicate:${existing.name}`

    const { data, error } = await supabase
      .from('exercises')
      .insert({
        name,
        normalized_name: normalized,
        weight_type: weightType,
        primary_workout_type: workoutType,
        workout_type_tags: [workoutType],
      })
      .select()
      .single()
    if (error) return 'error'

    setExercises(prev => [...prev, data])
    setLogs(prev => ({ ...prev, [data.id]: [] }))
    setExpandedId(data.id)
    return null
  }

  async function handleDeleteClick(exercise) {
    const today = todayStr()
    // Use local state as primary source (fetchData loaded all logs)
    const localLogs = logs[exercise.id] || []
    const localPrior = localLogs.filter(l => l.log_date < today)

    // Confirm with DB if local says no prior logs (critical path)
    let hasPriorLogs = localPrior.length > 0
    let priorCount   = localPrior.length

    if (!hasPriorLogs) {
      const { data: dbPrior } = await supabase
        .from('exercise_logs')
        .select('id')
        .eq('exercise_id', exercise.id)
        .lt('log_date', today)

      hasPriorLogs = Array.isArray(dbPrior) ? dbPrior.length > 0 : false
      priorCount   = Array.isArray(dbPrior) ? dbPrior.length : 0
    }

    const bodyText = hasPriorLogs
      ? `This will delete today's log for ${exercise.name}. The exercise and its ${priorCount} previous session${priorCount !== 1 ? 's' : ''} will be kept.`
      : `This will permanently remove ${exercise.name} from your library. It has no prior history.`

    setDeleteTarget({ exercise, hasPriorLogs, bodyText })
  }

  async function handleDelete() {
    const { exercise, hasPriorLogs } = deleteTarget
    const today = todayStr()

    if (!hasPriorLogs) {
      // Explicitly delete logs first, then exercise (safe even if CASCADE is set)
      await supabase.from('exercise_logs').delete().eq('exercise_id', exercise.id)
      const { error } = await supabase.from('exercises').delete().eq('id', exercise.id)
      if (!error) {
        setExercises(prev => prev.filter(e => e.id !== exercise.id))
        setLogs(prev => { const n = { ...prev }; delete n[exercise.id]; return n })
        showToast(`${exercise.name} removed from library`)
      } else {
        showToast('Delete failed — check permissions')
      }
    } else {
      const { error } = await supabase.from('exercise_logs').delete()
        .eq('exercise_id', exercise.id).eq('log_date', today)
      if (!error) {
        setLogs(prev => ({
          ...prev,
          [exercise.id]: (prev[exercise.id] || []).filter(l => l.log_date !== today),
        }))
        showToast(`Today's ${exercise.name} log removed`)
      }
    }

    setDeleteTarget(null)
  }

  async function handleDeleteTodaySession() {
    if (deletingSession) return
    setDeletingSession(true)
    const today = todayStr()

    for (const ex of exercises) {
      const todayLog = (logs[ex.id] || []).find(l => l.log_date === today)
      if (!todayLog) continue

      const priorLogs = (logs[ex.id] || []).filter(l => l.log_date < today)

      if (priorLogs.length === 0) {
        // No prior history: remove from library entirely
        await supabase.from('exercise_logs').delete().eq('exercise_id', ex.id)
        await supabase.from('exercises').delete().eq('id', ex.id)
        setExercises(prev => prev.filter(e => e.id !== ex.id))
        setLogs(prev => { const n = { ...prev }; delete n[ex.id]; return n })
      } else {
        // Has prior history: only delete today's log
        await supabase.from('exercise_logs').delete().eq('id', todayLog.id)
        setLogs(prev => ({
          ...prev,
          [ex.id]: (prev[ex.id] || []).filter(l => l.log_date !== today),
        }))
      }
    }

    setDeletingSession(false)
    onDeleteSession?.()
  }

  async function handleAddTag(exerciseId, type) {
    const exercise = exercises.find(e => e.id === exerciseId)
    if (!exercise) return
    const newTags = [...(exercise.workout_type_tags || []), type]
    const { error } = await supabase
      .from('exercises')
      .update({ workout_type_tags: newTags })
      .eq('id', exerciseId)
    if (!error) {
      setExercises(prev => prev.map(e => e.id === exerciseId ? { ...e, workout_type_tags: newTags } : e))
      showToast(`${exercise.name} added to ${type} day`)
    }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function handleMouseMove(e) {
    const rect = drawerRef.current?.getBoundingClientRect()
    if (!rect) return
    setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const today = todayStr()
  const hasTodaySession = exercises.some(ex => (logs[ex.id] || []).some(l => l.log_date === today))

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        style={{ zIndex: 100 }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed bottom-0 left-0 right-0 rounded-t-2xl flex flex-col animate-slide-up-drawer overflow-hidden"
        style={{
          zIndex: 101,
          height: '75vh',
          background: 'var(--drawer-bg)',
          borderTop: '1px solid var(--drawer-card-border)',
          borderLeft: '1px solid var(--drawer-card-border)',
          borderRight: '1px solid var(--drawer-card-border)',
          position: 'fixed',
        }}
        onClick={e => e.stopPropagation()}
        onMouseMove={handleMouseMove}
      >
        {/* Atmospheric cursor glow */}
        <div
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            width: 400, height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--drawer-cursor-glow) 0%, transparent 70%)',
            left: cursor.x - 200,
            top: cursor.y - 200,
            zIndex: 0,
            transition: 'left 60ms ease, top 60ms ease',
          }}
        />
        {/* Atmospheric blob 1 */}
        <div style={{
          position: 'absolute', pointerEvents: 'none', zIndex: 0,
          width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, var(--drawer-blob-1) 0%, transparent 70%)',
          top: -80, right: -60,
          animation: 'drawerBlobDrift 18s ease-in-out infinite',
        }} />
        {/* Atmospheric blob 2 */}
        <div style={{
          position: 'absolute', pointerEvents: 'none', zIndex: 0,
          width: 260, height: 260, borderRadius: '50%',
          background: 'radial-gradient(circle, var(--drawer-blob-2) 0%, transparent 70%)',
          bottom: 120, left: -60,
          animation: 'drawerBlobDrift 24s ease-in-out infinite reverse',
        }} />

        {/* Content above blobs */}
        <div className="flex flex-col flex-1 min-h-0 relative" style={{ zIndex: 1 }}>
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--drawer-card-border)' }} />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--drawer-card-border)' }}>
            <h2 className="font-display font-semibold text-base text-os-fg">
              {WORKOUT_EMOJIS[workoutType] || '🏋️'} {workoutType} Day
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-os-muted hover:text-os-fg transition-colors">
              <i className="ti ti-x text-lg" />
            </button>
          </div>

          {/* Transfer banner */}
          {showTransferBanner && (
            <div className="mx-4 mt-3 flex-shrink-0 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-body text-os-secondary flex-1">
                  ↔️ You have a <span className="font-semibold text-os-fg">{fromType}</span> session from today. Move it here?
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleTransfer}
                    disabled={transferring}
                    className="text-xs font-body font-semibold px-2.5 py-1.5 rounded-lg transition-opacity disabled:opacity-60"
                    style={{ background: 'rgba(99,102,241,0.18)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.35)' }}
                  >
                    {transferring ? '…' : 'Transfer'}
                  </button>
                  <button
                    onClick={() => setShowTransferBanner(false)}
                    className="text-xs font-body text-os-muted hover:text-os-fg transition-colors px-1"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-sm font-body text-os-muted">Loading exercises…</span>
              </div>
            ) : exercises.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <i className="ti ti-dumbbell text-3xl text-os-muted" />
                <span className="text-sm font-body text-os-muted text-center px-8">
                  No exercises yet. Add one below to start tracking sets.
                </span>
              </div>
            ) : (
              exercises.map(ex => (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  logs={logs[ex.id] || []}
                  expanded={expandedId === ex.id}
                  onToggle={() => setExpandedId(prev => prev === ex.id ? null : ex.id)}
                  onCollapse={() => setExpandedId(prev => prev === ex.id ? null : prev)}
                  onLogSave={entry => handleLogSave(ex.id, entry)}
                  onOpenGraph={() => setGraphExercise(ex)}
                  onDelete={() => handleDeleteClick(ex)}
                  onAddTag={handleAddTag}
                />
              ))
            )}
          </div>

          {/* Bottom bar */}
          <div className="flex-shrink-0 px-4 pb-6 pt-3 space-y-2" style={{ borderTop: '1px solid var(--drawer-card-border)' }}>
            {hasTodaySession && (
              <button
                onClick={handleDeleteTodaySession}
                disabled={deletingSession}
                className="w-full py-2 rounded-lg text-sm font-body font-medium transition-all disabled:opacity-50"
                style={{ border: '1px solid rgba(239,68,68,0.4)', color: '#EF4444', background: 'rgba(239,68,68,0.06)' }}
              >
                {deletingSession ? 'Deleting…' : '🗑️ Delete today\'s session'}
              </button>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => !viewOnly && setShowAdd(true)}
                disabled={viewOnly}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-body font-medium text-os-secondary hover:text-os-fg transition-colors"
                style={{
                  border: '1px solid var(--drawer-card-border)',
                  opacity: viewOnly ? 0.5 : 1,
                  cursor: viewOnly ? 'not-allowed' : 'pointer',
                }}
              >
                <i className="ti ti-plus text-base" />
                Add exercise
              </button>
              <button
                onClick={onDone}
                className="flex-1 py-2 rounded-lg text-sm font-body font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: '#6366F1' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>

      {showAdd && (
        <AddExerciseModal
          workoutType={workoutType}
          onAdd={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}

      {graphExercise && (
        <ProgressGraph
          exercise={graphExercise}
          logs={logs[graphExercise.id] || []}
          onClose={() => setGraphExercise(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          exercise={deleteTarget.exercise}
          bodyText={deleteTarget.bodyText}
          confirmText={deleteTarget.hasPriorLogs ? "Delete today's log" : 'Delete permanently'}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-body text-white shadow-lg whitespace-nowrap animate-slide-up-fade"
          style={{ zIndex: 400, background: '#1C1C2E' }}
        >
          {toast}
        </div>
      )}
    </>
  )
}
