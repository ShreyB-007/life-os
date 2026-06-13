import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/date'
import ProgressGraph from './ProgressGraph'

const WORKOUT_TYPES = ['Push', 'Pull', 'Legs', 'Cardio']

function daysSince(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  return Math.floor((today - d) / 86400000)
}

function fmtDate(dateStr) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const [, m, d] = dateStr.split('-')
  return `${months[parseInt(m) - 1]} ${parseInt(d)}`
}

function fmtSets(log, wt) {
  if (!log?.sets?.length) return '—'
  const s = log.sets
  if (wt === 'barbell' || wt === 'dumbbell') return s.map(x => `${x.weight}×${x.reps}`).join(' / ')
  if (wt === 'cable') return s.map(x => x.plates !== undefined ? `P${x.plates}M${x.mini}×${x.reps}` : `${x.weight}×${x.reps}`).join(' / ')
  if (wt === 'reps') return s.map(x => `${x.reps}`).join(' / ') + ' reps'
  if (wt === 'time') return s.map(x => {
    const t = x.duration || 0
    const m = Math.floor(t / 60), sec = t % 60
    return m > 0 ? `${m}m${sec > 0 ? sec + 's' : ''}` : `${sec}s`
  }).join(' / ')
  return '—'
}

function daysLabel(days) {
  if (days === null) return 'Never logged'
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

function HistoryExerciseCard({ exercise, logs, dateFilter, onOpenGraph }) {
  const wt = exercise.weight_type
  const today = todayStr()
  const mostRecent = logs[0] ?? null
  const days = daysSince(mostRecent?.log_date ?? null)

  const displayLogs = dateFilter === 'today'
    ? logs.filter(l => l.log_date === today)
    : logs.slice(0, 5)

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--drawer-card-bg)', border: '1px solid var(--drawer-card-border)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-semibold text-sm text-os-fg">{exercise.name}</span>
            <span
              className="text-[10px] font-body text-os-muted px-1.5 py-0.5 rounded capitalize flex-shrink-0"
              style={{ background: 'var(--drawer-ref-bg)' }}
            >
              {wt}
            </span>
          </div>
          <p className="text-xs font-body text-os-muted mt-0.5">{daysLabel(days)}</p>
        </div>
        <button
          onClick={onOpenGraph}
          className="p-1.5 rounded-md text-os-muted hover:text-os-indigo transition-colors flex-shrink-0"
          title="View progress graph"
        >
          <i className="ti ti-chart-line text-sm" />
        </button>
      </div>

      {displayLogs.length === 0 ? (
        <p className="text-xs font-body text-os-muted">
          {dateFilter === 'today' ? 'No workout logged today' : 'No sessions logged yet'}
        </p>
      ) : (
        <div className="space-y-1.5">
          {displayLogs.map(log => (
            <div key={log.id} className="flex items-baseline gap-2 text-xs font-body">
              <span className="text-os-muted flex-shrink-0 w-12">{fmtDate(log.log_date)}</span>
              <span className="text-os-muted">—</span>
              <span className="text-os-secondary">{fmtSets(log, wt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HistoryDrawer({ onClose }) {
  const [activeType, setActiveType]     = useState('Push')
  const [dateFilter, setDateFilter]     = useState('all')
  const [exercises, setExercises]       = useState([])
  const [logs, setLogs]                 = useState({})
  const [loading, setLoading]           = useState(true)
  const [graphExercise, setGraphExercise] = useState(null)

  useEffect(() => { fetchForType(activeType) }, [activeType])

  async function fetchForType(type) {
    setLoading(true)
    const { data: exs } = await supabase
      .from('exercises')
      .select('*')
      .contains('workout_type_tags', [type])
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

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        style={{ zIndex: 100 }}
        onClick={onClose}
      />

      <div
        className="fixed bottom-0 left-0 right-0 rounded-t-2xl flex flex-col animate-slide-up-drawer"
        style={{
          zIndex: 101,
          height: '80vh',
          background: 'var(--drawer-bg)',
          borderTop: '1px solid var(--drawer-card-border)',
          borderLeft: '1px solid var(--drawer-card-border)',
          borderRight: '1px solid var(--drawer-card-border)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--drawer-card-border)' }} />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--drawer-card-border)' }}
        >
          <div className="flex items-center gap-2">
            <h2 className="font-display font-semibold text-base text-os-fg">Workout History</h2>
            <span
              className="text-[10px] font-body text-os-muted px-1.5 py-0.5 rounded"
              style={{ background: 'var(--drawer-ref-bg)' }}
            >
              View only
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-os-muted hover:text-os-fg transition-colors">
            <i className="ti ti-x text-lg" />
          </button>
        </div>

        {/* Workout type tab bar */}
        <div className="flex gap-1 px-4 pt-3 pb-1 flex-shrink-0">
          {WORKOUT_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className="flex-1 py-1.5 text-xs font-body rounded-lg transition-all"
              style={activeType === type ? {
                background: 'rgba(99,102,241,0.15)',
                color: '#818CF8',
                border: '1px solid rgba(99,102,241,0.4)',
              } : {
                color: 'var(--os-secondary)',
                border: '1px solid transparent',
              }}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Date filter segmented control */}
        <div className="flex items-center gap-1 px-4 py-2 flex-shrink-0">
          {[{ key: 'all', label: 'All time' }, { key: 'today', label: 'Today' }].map(opt => (
            <button
              key={opt.key}
              onClick={() => setDateFilter(opt.key)}
              className="px-3 py-1 text-xs font-body rounded-full transition-all"
              style={dateFilter === opt.key ? {
                background: 'var(--drawer-card-bg-exp)',
                color: 'var(--os-fg)',
                border: '1px solid var(--drawer-card-border)',
              } : {
                color: 'var(--os-muted)',
                border: '1px solid transparent',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Exercise list */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-sm font-body text-os-muted">Loading…</span>
            </div>
          ) : exercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <i className="ti ti-dumbbell text-3xl text-os-muted" />
              <span className="text-sm font-body text-os-muted text-center px-8">
                No exercises in {activeType} yet
              </span>
            </div>
          ) : (
            exercises.map(ex => (
              <HistoryExerciseCard
                key={ex.id}
                exercise={ex}
                logs={logs[ex.id] || []}
                dateFilter={dateFilter}
                onOpenGraph={() => setGraphExercise(ex)}
              />
            ))
          )}
        </div>
      </div>

      {graphExercise && (
        <ProgressGraph
          exercise={graphExercise}
          logs={logs[graphExercise.id] || []}
          onClose={() => setGraphExercise(null)}
        />
      )}
    </>
  )
}
