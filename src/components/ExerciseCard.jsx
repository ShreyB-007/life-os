import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/date'

function daysSince(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  return Math.floor((today - d) / 86400000)
}

function formatLastSession(log, weightType) {
  if (!log || !log.sets || log.sets.length === 0) return null
  const s = log.sets
  if (weightType === 'barbell' || weightType === 'dumbbell' || weightType === 'cable') {
    return s.map(x => `${x.weight}kg×${x.reps}`).join(' / ')
  }
  if (weightType === 'reps') {
    return s.map(x => `${x.reps} reps`).join(' / ')
  }
  if (weightType === 'time') {
    return s.map(x => {
      const m = Math.floor((x.duration || 0) / 60)
      const sec = (x.duration || 0) % 60
      return m > 0 ? `${m}m${sec > 0 ? sec + 's' : ''}` : `${sec}s`
    }).join(' / ')
  }
  return null
}

function defaultSets(weightType) {
  const row3 = Array.from({ length: 3 })
  if (weightType === 'barbell' || weightType === 'dumbbell' || weightType === 'cable') {
    return row3.map(() => ({ weight: '', reps: '' }))
  }
  if (weightType === 'reps') {
    return row3.map(() => ({ reps: '' }))
  }
  return row3.map(() => ({ mins: '', secs: '' }))
}

function setsFromLog(log, weightType) {
  if (!log || !log.sets || log.sets.length === 0) return defaultSets(weightType)
  const s = log.sets
  if (weightType === 'time') {
    return s.map(x => ({
      mins: String(Math.floor((x.duration || 0) / 60) || ''),
      secs: String((x.duration || 0) % 60 || ''),
    }))
  }
  if (weightType === 'barbell' || weightType === 'dumbbell' || weightType === 'cable') {
    return s.map(x => ({ weight: x.weight != null ? String(x.weight) : '', reps: x.reps != null ? String(x.reps) : '' }))
  }
  return s.map(x => ({ reps: x.reps != null ? String(x.reps) : '' }))
}

function emptySetRow(weightType) {
  if (weightType === 'barbell' || weightType === 'dumbbell' || weightType === 'cable') return { weight: '', reps: '' }
  if (weightType === 'reps') return { reps: '' }
  return { mins: '', secs: '' }
}

export default function ExerciseCard({ exercise, logs, expanded, onToggle, onCollapse, onLogSave, onOpenGraph, onDelete }) {
  const today = todayStr()
  const wt = exercise.weight_type

  const todayLog = logs.find(l => l.log_date === today) ?? null
  const lastLog  = logs.find(l => l.log_date !== today) ?? null
  const mostRecent = logs[0] ?? null

  const [sets, setSets] = useState(() => setsFromLog(todayLog, wt))
  const [saved, setSaved] = useState(!!todayLog)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSets(setsFromLog(todayLog, wt))
    setSaved(!!todayLog)
  }, [todayLog?.log_date])

  const days = daysSince(mostRecent?.log_date ?? null)
  const daysLabel = days === null ? 'Never done'
    : days === 0 ? 'Done today'
    : days === 1 ? 'Yesterday'
    : `${days} days ago`
  const daysWarning = days !== null && days >= 14

  function updateSet(idx, field, value) {
    setSets(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
    setSaved(false)
  }

  function addSet() {
    setSets(prev => [...prev, emptySetRow(wt)])
  }

  function removeSet() {
    if (sets.length <= 1) return
    setSets(prev => prev.slice(0, -1))
    setSaved(false)
  }

  function buildPayload() {
    return sets.map(s => {
      if (wt === 'barbell' || wt === 'dumbbell' || wt === 'cable') {
        return { reps: parseInt(s.reps) || 0, weight: parseFloat(s.weight) || 0 }
      }
      if (wt === 'reps') return { reps: parseInt(s.reps) || 0 }
      const duration = (parseInt(s.mins) || 0) * 60 + (parseInt(s.secs) || 0)
      return { duration }
    })
  }

  async function handleLog() {
    const payload = buildPayload()
    const entry = {
      exercise_id: exercise.id,
      log_date: today,
      sets: payload,
      logged_at: new Date().toISOString(),
    }
    onLogSave({ ...entry, id: todayLog?.id ?? `opt-${Date.now()}` })
    setSaving(true)
    setSaved(true)
    await supabase.from('exercise_logs').upsert(entry, { onConflict: 'exercise_id,log_date' })
    setSaving(false)
    setTimeout(() => onCollapse(), 1500)
  }

  return (
    <div
      className={[
        'rounded-xl overflow-hidden transition-all duration-200',
        expanded ? '' : 'card-interactive cursor-pointer',
      ].join(' ')}
      style={{
        background: expanded ? 'var(--drawer-card-bg-exp)' : 'var(--drawer-card-bg)',
        border: '1px solid var(--drawer-card-border)',
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-sm text-os-fg truncate">
              {exercise.name}
            </span>
            {saved && <i className="ti ti-circle-check text-emerald-500 text-sm flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={['text-xs font-body', daysWarning ? 'text-amber-500' : 'text-os-muted'].join(' ')}>
              {daysLabel}
            </span>
            <span className="text-xs font-body text-os-muted capitalize opacity-50">·</span>
            <span className="text-xs font-body text-os-muted capitalize">{wt}</span>
          </div>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
          <button
            onClick={e => { e.stopPropagation(); onOpenGraph() }}
            className="p-2 rounded-md text-os-muted hover:text-os-indigo transition-colors"
            title="View progress"
          >
            <i className="ti ti-chart-line text-sm" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-2 rounded-md text-os-muted hover:text-red-500 transition-colors"
            title="Delete exercise"
          >
            <i className="ti ti-trash text-sm" />
          </button>
          <i className={[
            'ti text-sm text-os-muted transition-transform duration-200 mr-0.5',
            expanded ? 'ti-chevron-up' : 'ti-chevron-down',
          ].join(' ')} />
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--drawer-card-border)' }}>
          {/* Last session reference */}
          {lastLog && (
            <div
              className="mt-3 mb-3 px-3 py-2 rounded-lg"
              style={{ background: 'var(--drawer-ref-bg)' }}
            >
              <p className="text-xs font-body text-os-muted">
                Last ({lastLog.log_date}):{' '}
                <span className="text-os-secondary">
                  {formatLastSession(lastLog, wt) || '—'}
                </span>
              </p>
            </div>
          )}

          {/* Set rows */}
          <div className="space-y-2 mt-3">
            {sets.map((set, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs font-mono text-os-muted w-10 flex-shrink-0 select-none">
                  Set {i + 1}
                </span>

                {(wt === 'barbell' || wt === 'dumbbell' || wt === 'cable') && (
                  <>
                    <input
                      type="number"
                      placeholder="kg"
                      value={set.weight}
                      onChange={e => updateSet(i, 'weight', e.target.value)}
                      className="drawer-input w-20"
                    />
                    <span className="text-xs text-os-muted select-none">×</span>
                    <input
                      type="number"
                      placeholder="reps"
                      value={set.reps}
                      onChange={e => updateSet(i, 'reps', e.target.value)}
                      className="drawer-input w-20"
                    />
                  </>
                )}

                {wt === 'reps' && (
                  <input
                    type="number"
                    placeholder="reps"
                    value={set.reps}
                    onChange={e => updateSet(i, 'reps', e.target.value)}
                    className="drawer-input w-28"
                  />
                )}

                {wt === 'time' && (
                  <>
                    <input
                      type="number"
                      placeholder="mm"
                      value={set.mins}
                      onChange={e => updateSet(i, 'mins', e.target.value)}
                      className="drawer-input w-16"
                    />
                    <span className="text-xs text-os-muted select-none">:</span>
                    <input
                      type="number"
                      placeholder="ss"
                      value={set.secs}
                      onChange={e => updateSet(i, 'secs', e.target.value)}
                      className="drawer-input w-16"
                    />
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add / remove set */}
          <div className="flex gap-4 mt-3">
            <button
              onClick={removeSet}
              disabled={sets.length <= 1}
              className="text-xs font-body text-os-muted hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              − Remove set
            </button>
            <button
              onClick={addSet}
              className="text-xs font-body text-os-muted hover:text-os-fg transition-colors"
            >
              + Add set
            </button>
          </div>

          {/* Log button */}
          <button
            onClick={handleLog}
            disabled={saving}
            className="mt-4 w-full py-2 rounded-lg text-sm font-body font-semibold transition-all disabled:opacity-60"
            style={saved ? {
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)',
              color: '#10B981',
            } : {
              background: '#6366F1',
              border: 'none',
              color: 'white',
            }}
          >
            {saving ? 'Saving…' : saved ? '✓ Logged' : 'Log workout'}
          </button>
        </div>
      )}
    </div>
  )
}
