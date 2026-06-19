import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/date'
import { getLocalDate } from '../lib/dateUtils'
import { normalizeExerciseName } from '../lib/exercise'
import ExerciseCard from './ExerciseCard'
import AddExerciseModal from './AddExerciseModal'
import DeleteConfirmModal from './DeleteConfirmModal'
import ProgressGraph from './ProgressGraph'

const WORKOUT_EMOJIS = { Push: '💪', Pull: '🏋️', Legs: '🦵', Cardio: '🏃' }

function transferNormalizedName(normalizedName, workoutType) {
  return `${normalizedName}__${workoutType.toLowerCase()}`
}

export default function WorkoutDrawer({ workoutType, fromType, viewOnly, onClose, onDone, onDeleteSession, onFirstExerciseLogged, onTransferComplete }) {
  const [exercises, setExercises]             = useState([])
  const [logs, setLogs]                       = useState({})
  const [loading, setLoading]                 = useState(true)
  const [expandedId, setExpandedId]           = useState(null)
  const [showAdd, setShowAdd]                 = useState(false)
  const [graphExercise, setGraphExercise]     = useState(null)
  const [deleteTarget, setDeleteTarget]       = useState(null)
  const [removeExTarget, setRemoveExTarget]   = useState(null)
  const [toast, setToast]                     = useState(null)
  const [showTransferBanner, setShowTransferBanner] = useState(false)
  const [transferring, setTransferring]       = useState(false)
  const [deletingSession, setDeletingSession] = useState(false)

  const drawerRef = useRef(null)

  useEffect(() => { fetchData() }, [workoutType])

  // Cursor glow — direct DOM manipulation, bypassing React state, so tracking
  // runs at native mouse speed instead of re-rendering on every mousemove.
  useEffect(() => {
    const el = drawerRef.current
    if (!el) return
    function handleDrawerMove(e) {
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--drawer-cursor-x', `${e.clientX - rect.left - 200}px`)
      el.style.setProperty('--drawer-cursor-y', `${e.clientY - rect.top - 200}px`)
    }
    el.addEventListener('mousemove', handleDrawerMove, { passive: true })
    return () => el.removeEventListener('mousemove', handleDrawerMove)
  }, [])

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
    const today = getLocalDate()

    try {
      // Step 1: fetch today's exercise_logs for fromType.
      const { data: fromExs } = await supabase
        .from('exercises')
        .select('id, name, normalized_name, workout_type_tags, primary_workout_type, weight_type')
        .contains('workout_type_tags', [fromType])

      if (!fromExs?.length) { setShowTransferBanner(false); return }

      const sourceExerciseIds = fromExs.map(e => e.id)
      const { data: fromLogs } = await supabase
        .from('exercise_logs')
        .select('*')
        .in('exercise_id', sourceExerciseIds)
        .eq('log_date', today)

      if (!fromLogs?.length) { setShowTransferBanner(false); return }

      // Step 2: for each log, upsert into toType, creating a target exercise if needed.
      for (const log of fromLogs) {
        const srcEx = fromExs.find(e => e.id === log.exercise_id)
        if (!srcEx) continue

        const alias = transferNormalizedName(srcEx.normalized_name, workoutType)
        const { data: targetMatches } = await supabase
          .from('exercises')
          .select('id, workout_type_tags')
          .in('normalized_name', [srcEx.normalized_name, alias])

        let targetEx = targetMatches?.find(ex =>
          ex.id !== srcEx.id && (ex.workout_type_tags || []).includes(workoutType)
        )

        if (!targetEx) {
          const existingAlias = targetMatches?.find(ex => ex.id !== srcEx.id)
          if (existingAlias) {
            const nextTags = [...new Set([...(existingAlias.workout_type_tags || []), workoutType])]
            const { data: updated, error: updateErr } = await supabase
              .from('exercises')
              .update({ workout_type_tags: nextTags, primary_workout_type: workoutType })
              .eq('id', existingAlias.id)
              .select('id')
              .single()
            if (updateErr) throw updateErr
            targetEx = updated
          } else {
            const { data: created, error: createErr } = await supabase
              .from('exercises')
              .insert({
                name: srcEx.name,
                normalized_name: alias,
                weight_type: srcEx.weight_type,
                primary_workout_type: workoutType,
                workout_type_tags: [workoutType],
              })
              .select('id')
              .single()
            if (createErr) throw createErr
            targetEx = created
          }
        }

        const { error: upsertErr } = await supabase.from('exercise_logs').upsert({
          exercise_id: targetEx.id,
          log_date: log.log_date,
          sets: log.sets,
          logged_at: log.logged_at,
        }, { onConflict: 'exercise_id,log_date' })
        if (upsertErr) throw upsertErr
      }

      // Step 3: explicitly delete all of today's logs from source exercises.
      const { error: deleteErr } = await supabase
        .from('exercise_logs')
        .delete()
        .in('exercise_id', sourceExerciseIds)
        .eq('log_date', getLocalDate())
      if (deleteErr) {
        console.error('Transfer source delete failed:', deleteErr)
        showToast('Transfer failed - source logs were not deleted')
        return
      }

      // Step 4: no-prior-history cleanup on fromType exercises.
      for (const srcEx of fromExs) {
        const { data: remainingLogs } = await supabase
          .from('exercise_logs')
          .select('id')
          .eq('exercise_id', srcEx.id)
          .limit(1)

        if (!remainingLogs?.length) {
          await supabase.from('exercises').delete().eq('id', srcEx.id)
        }
      }

      // Step 5: update habit_logs payload to toType.
      await supabase.from('habit_logs').upsert({
        habit_key: 'gym',
        log_date: today,
        done: true,
        is_rest_day: false,
        payload: { workout_type: workoutType },
        logged_at: new Date().toISOString(),
      }, { onConflict: 'habit_key,log_date' })

      // Step 6: update local state optimistically.
      setShowTransferBanner(false)
      await fetchData()
      showToast(`Session transferred from ${fromType}`)
      onTransferComplete?.(workoutType)

    } catch {
      showToast('Transfer failed - please try again')
    } finally {
      setTransferring(false)
    }
  }
  function handleLogSave(exerciseId, entry) {
    const alreadyHadTodaySession = exercises.some(ex =>
      (logs[ex.id] || []).some(l => l.log_date === entry.log_date)
    )
    setLogs(prev => ({
      ...prev,
      [exerciseId]: [entry, ...(prev[exerciseId] || []).filter(l => l.log_date !== entry.log_date)],
    }))
    if (!alreadyHadTodaySession && entry.log_date === getLocalDate()) {
      onFirstExerciseLogged?.(workoutType)
    }
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

  async function handleRemoveExerciseClick(exercise) {
    const today = todayStr()
    const localLogs = logs[exercise.id] || []
    const localPrior = localLogs.filter(l => l.log_date < today)

    let priorCount = localPrior.length

    if (priorCount === 0) {
      const { data: dbPrior } = await supabase
        .from('exercise_logs')
        .select('id')
        .eq('exercise_id', exercise.id)
        .lt('log_date', today)

      priorCount = Array.isArray(dbPrior) ? dbPrior.length : 0
    }

    const bodyText = priorCount > 0
      ? `This will permanently delete ${exercise.name} and all ${priorCount} logged session${priorCount !== 1 ? 's' : ''}. This cannot be undone.`
      : `This will permanently remove ${exercise.name} from your library.`

    setRemoveExTarget({ exercise, bodyText })
  }

  async function handleRemoveExercise() {
    const { exercise } = removeExTarget
    await supabase.from('exercise_logs').delete().eq('exercise_id', exercise.id)
    const { error } = await supabase.from('exercises').delete().eq('id', exercise.id)
    if (!error) {
      setExercises(prev => prev.filter(e => e.id !== exercise.id))
      setLogs(prev => { const n = { ...prev }; delete n[exercise.id]; return n })
      showToast(`${exercise.name} removed`)
    } else {
      showToast('Delete failed — check permissions')
    }
    setRemoveExTarget(null)
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
      >
        {/* Atmospheric cursor glow — position driven by CSS vars set via direct DOM writes */}
        <div
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            width: 400, height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--drawer-cursor-glow) 0%, transparent 70%)',
            left: 'var(--drawer-cursor-x, 0px)',
            top: 'var(--drawer-cursor-y, 0px)',
            zIndex: 0,
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
                  onRemoveExercise={() => handleRemoveExerciseClick(ex)}
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
                className="action-pill-btn action-pill-indigo"
              >
                <i className="ti ti-plus" />
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

      {removeExTarget && (
        <DeleteConfirmModal
          title={`Remove ${removeExTarget.exercise.name}?`}
          exercise={removeExTarget.exercise}
          bodyText={removeExTarget.bodyText}
          confirmText="Remove permanently"
          onConfirm={handleRemoveExercise}
          onCancel={() => setRemoveExTarget(null)}
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
