import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/date'
import { normalizeExerciseName } from '../lib/exercise'
import ExerciseCard from './ExerciseCard'
import AddExerciseModal from './AddExerciseModal'
import DeleteConfirmModal from './DeleteConfirmModal'
import ProgressGraph from './ProgressGraph'

export default function WorkoutDrawer({ workoutType, onClose, onDone }) {
  const [exercises, setExercises] = useState([])
  const [logs, setLogs]           = useState({})   // exercise_id → log[] sorted desc
  const [loading, setLoading]     = useState(true)
  const [expandedId, setExpandedId]   = useState(null)
  const [showAdd, setShowAdd]         = useState(false)
  const [graphExercise, setGraphExercise] = useState(null)
  const [deleteTarget, setDeleteTarget]   = useState(null)
  const [toast, setToast]             = useState(null)

  useEffect(() => { fetchData() }, [workoutType])

  async function fetchData() {
    setLoading(true)
    // Exercises are global; fetch those tagged for this workout type
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
    }
    setLoading(false)
  }

  function handleLogSave(exerciseId, entry) {
    setLogs(prev => ({
      ...prev,
      [exerciseId]: [entry, ...(prev[exerciseId] || []).filter(l => l.log_date !== entry.log_date)],
    }))
  }

  // Returns null on success, or a string error for AddExerciseModal
  async function handleAdd(name, weightType) {
    const normalized = normalizeExerciseName(name)

    // Check global duplicate by normalized_name
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
    const { data: priorLogs } = await supabase
      .from('exercise_logs')
      .select('id')
      .eq('exercise_id', exercise.id)
      .lt('log_date', today)

    const priorCount = priorLogs?.length || 0
    const hasPriorLogs = priorCount > 0
    const bodyText = hasPriorLogs
      ? `This will delete today's log for ${exercise.name}. The exercise and its ${priorCount} previous session${priorCount !== 1 ? 's' : ''} will be kept.`
      : `This will permanently remove ${exercise.name} and all its data from your library. It has no prior history.`

    setDeleteTarget({ exercise, hasPriorLogs, bodyText })
  }

  async function handleDelete() {
    const { exercise, hasPriorLogs } = deleteTarget
    const today = todayStr()

    if (!hasPriorLogs) {
      await supabase.from('exercises').delete().eq('id', exercise.id)
      setExercises(prev => prev.filter(e => e.id !== exercise.id))
      setLogs(prev => { const n = { ...prev }; delete n[exercise.id]; return n })
      showToast(`${exercise.name} deleted`)
    } else {
      await supabase.from('exercise_logs').delete()
        .eq('exercise_id', exercise.id).eq('log_date', today)
      setLogs(prev => ({
        ...prev,
        [exercise.id]: (prev[exercise.id] || []).filter(l => l.log_date !== today),
      }))
      showToast(`Today's ${exercise.name} log removed`)
    }

    setDeleteTarget(null)
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

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

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
        className="fixed bottom-0 left-0 right-0 rounded-t-2xl flex flex-col animate-slide-up-drawer"
        style={{ zIndex: 101, height: '75vh', background: 'var(--drawer-bg)', borderTop: '1px solid var(--drawer-card-border)', borderLeft: '1px solid var(--drawer-card-border)', borderRight: '1px solid var(--drawer-card-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--drawer-card-border)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--drawer-card-border)' }}>
          <h2 className="font-display font-semibold text-base text-os-fg">{workoutType} Day</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-os-muted hover:text-os-fg transition-colors">
            <i className="ti ti-x text-lg" />
          </button>
        </div>

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
        <div className="flex-shrink-0 px-4 pb-6 pt-3 flex gap-3" style={{ borderTop: '1px solid var(--drawer-card-border)' }}>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-body font-medium text-os-secondary hover:text-os-fg transition-colors"
            style={{ border: '1px solid var(--drawer-card-border)' }}
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
