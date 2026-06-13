import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/date'
import { getLocalDateString } from '../lib/dateUtils'
import ProgressGraph from './ProgressGraph'
import DeleteConfirmModal from './DeleteConfirmModal'

const WORKOUT_TYPES = ['Push', 'Pull', 'Legs', 'Cardio']

// ── Shared form utilities (mirror of ExerciseCard) ──────────────────────────

function roundTo2p5(val) { return Math.round(val / 2.5) * 2.5 }
function isMultipleOf2p5(val) { return Math.abs(roundTo2p5(val) - val) < 0.001 }
function stripInt(val) { return val.replace(/[^0-9]/g, '') }
function stripWeight(val) { return val.replace(/[^0-9.]/g, '').replace(/^(\d*\.?\d*).*$/, '$1') }

function validateSet(set, wt) {
  const errors = {}
  if (wt === 'barbell' || wt === 'dumbbell') {
    const w = parseFloat(set.weight), r = parseInt(set.reps)
    if (isNaN(w) || w < 2.5)      errors.weight = 'Min 2.5 kg'
    else if (!isMultipleOf2p5(w)) errors.weight = 'Must be a multiple of 2.5 kg'
    if (isNaN(r) || r < 1)        errors.reps   = 'Reps must be at least 1'
  } else if (wt === 'cable') {
    const p = parseInt(set.plates), m = parseInt(set.mini), r = parseInt(set.reps)
    if (isNaN(p) || p < 1)  errors.plates = 'Plates must be at least 1'
    if (isNaN(m) || m < 0)  errors.mini   = 'Min 0'
    else if (m > 2)         errors.mini   = 'Max 2 mini-plates'
    if (isNaN(r) || r < 1)  errors.reps   = 'Reps must be at least 1'
  } else if (wt === 'reps') {
    const r = parseInt(set.reps)
    if (isNaN(r) || r < 1)  errors.reps = 'Reps must be at least 1'
  } else if (wt === 'time') {
    const total = (parseInt(set.mins) || 0) * 60 + (parseInt(set.secs) || 0)
    if (total <= 0) errors.mins = 'Duration must be greater than 0'
  }
  return errors
}

function defaultSets(wt) {
  const e3 = Array.from({ length: 3 })
  if (wt === 'barbell' || wt === 'dumbbell') return e3.map(() => ({ weight: '', reps: '' }))
  if (wt === 'cable')  return e3.map(() => ({ plates: '', mini: '', reps: '' }))
  if (wt === 'reps')   return e3.map(() => ({ reps: '' }))
  return e3.map(() => ({ mins: '', secs: '' }))
}

function setsFromLog(log, wt) {
  if (!log?.sets?.length) return defaultSets(wt)
  const s = log.sets
  if (wt === 'cable') {
    return s.map(x => x.plates !== undefined
      ? { plates: String(x.plates ?? ''), mini: String(x.mini ?? ''), reps: String(x.reps ?? '') }
      : { plates: '', mini: '', reps: String(x.reps ?? '') })
  }
  if (wt === 'time') {
    return s.map(x => {
      const total = x.duration || 0
      return { mins: String(Math.floor(total / 60) || ''), secs: String(total % 60 || '') }
    })
  }
  if (wt === 'barbell' || wt === 'dumbbell') {
    return s.map(x => ({ weight: x.weight != null ? String(x.weight) : '', reps: x.reps != null ? String(x.reps) : '' }))
  }
  return s.map(x => ({ reps: x.reps != null ? String(x.reps) : '' }))
}

function buildPayload(sets, wt) {
  return sets.map(s => {
    if (wt === 'barbell' || wt === 'dumbbell') return { weight: parseFloat(s.weight) || 0, reps: parseInt(s.reps) || 0 }
    if (wt === 'cable')  return { plates: parseInt(s.plates) || 0, mini: parseInt(s.mini) || 0, reps: parseInt(s.reps) || 0 }
    if (wt === 'reps')   return { reps: parseInt(s.reps) || 0 }
    return { duration: (parseInt(s.mins) || 0) * 60 + (parseInt(s.secs) || 0) }
  })
}

// ── Display helpers ──────────────────────────────────────────────────────────

function daysSince(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.floor((today - new Date(dateStr + 'T00:00:00')) / 86400000)
}

function getMaxValFromLog(log, wt) {
  if (!log?.sets?.length) return 0
  return Math.max(0, ...log.sets.map(s => {
    if (wt === 'barbell' || wt === 'dumbbell') return parseFloat(s.weight) || 0
    if (wt === 'cable') return (parseInt(s.plates) || 0) + (parseInt(s.mini) || 0) * 0.5
    if (wt === 'reps') return parseInt(s.reps) || 0
    return 0
  }))
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
    const t = x.duration || 0; const m = Math.floor(t / 60), sec = t % 60
    return m > 0 ? `${m}m${sec > 0 ? sec + 's' : ''}` : `${sec}s`
  }).join(' / ')
  return '—'
}

function daysLabel(days) {
  if (days === null) return 'Never logged'
  if (days === 0)    return 'Today'
  if (days === 1)    return 'Yesterday'
  return `${days}d ago`
}

// ── Inline session editor ────────────────────────────────────────────────────

function InlineSessionEditor({ log, exercise, onSave, onCancel }) {
  const wt = exercise.weight_type
  const [sets, setSets]               = useState(() => setsFromLog(log, wt))
  const [saving, setSaving]           = useState(false)
  const [touched, setTouched]         = useState(new Set())
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [weightNotes, setWeightNotes] = useState(new Set())
  const [miniNote, setMiniNote]       = useState(null)
  const [timeCapNote, setTimeCapNote] = useState(false)

  const setErrors   = sets.map(s => validateSet(s, wt))
  const formValid   = setErrors.every(e => Object.keys(e).length === 0)
  const showBlockStyle = submitAttempted && !formValid

  function isTouched(idx, field) { return touched.has(`${idx}-${field}`) || submitAttempted }
  function borderColor(idx, field) {
    if (!isTouched(idx, field)) return 'var(--drawer-card-border)'
    return setErrors[idx]?.[field] ? '#EF4444' : '#10B981'
  }
  function touchField(idx, field) { setTouched(prev => new Set([...prev, `${idx}-${field}`])) }
  function updateSet(idx, field, value) { setSets(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s)) }
  function updateSetMulti(idx, updates) { setSets(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s)) }
  function handleIntInput(idx, field, raw) { updateSet(idx, field, stripInt(raw)) }
  function handleWeightInput(idx, raw) { updateSet(idx, 'weight', stripWeight(raw)) }

  function handleWeightBlur(idx) {
    touchField(idx, 'weight')
    const raw = sets[idx].weight
    const val = parseFloat(raw)
    const rounded = !raw || isNaN(val) || val <= 0 ? 2.5 : Math.max(2.5, roundTo2p5(val))
    if (!raw || Math.abs(rounded - (isNaN(val) ? 0 : val)) > 0.001) {
      updateSet(idx, 'weight', String(rounded))
      setWeightNotes(prev => new Set([...prev, idx]))
      setTimeout(() => setWeightNotes(prev => { const n = new Set(prev); n.delete(idx); return n }), 2500)
    }
  }

  function adjustWeight(idx, delta) {
    const cur = parseFloat(sets[idx].weight) || 0
    updateSet(idx, 'weight', String(Math.max(2.5, roundTo2p5(cur + delta))))
    touchField(idx, 'weight')
  }

  function handleMiniInput(idx, raw) {
    const stripped = stripInt(raw)
    const num = parseInt(stripped) || 0
    if (num > 2) {
      updateSet(idx, 'mini', '2')
      setMiniNote({ setIdx: idx })
      setTimeout(() => setMiniNote(null), 2000)
    } else {
      updateSet(idx, 'mini', stripped)
    }
  }

  function handleMinsInput(idx, raw) {
    const stripped = stripInt(raw)
    const num = parseInt(stripped) || 0
    if (num > 59) {
      updateSet(idx, 'mins', '59')
      setTimeCapNote(true); setTimeout(() => setTimeCapNote(false), 2500)
    } else {
      updateSet(idx, 'mins', stripped)
    }
  }

  function handleSecsInput(idx, raw) {
    const stripped = stripInt(raw)
    const num = parseInt(stripped) || 0
    if (num >= 60) {
      const carry = Math.floor(num / 60), newSecs = num % 60
      const newMins = (parseInt(sets[idx].mins) || 0) + carry
      if (newMins > 59) {
        updateSetMulti(idx, { mins: '59', secs: String(newSecs) })
        setTimeCapNote(true); setTimeout(() => setTimeCapNote(false), 2500)
      } else {
        updateSetMulti(idx, { mins: String(newMins), secs: String(newSecs) })
      }
    } else {
      updateSet(idx, 'secs', stripped)
    }
  }

  async function handleSave() {
    setSubmitAttempted(true)
    if (!formValid) return
    const payload = buildPayload(sets, wt)
    setSaving(true)
    const entry = { exercise_id: exercise.id, log_date: log.log_date, sets: payload }
    const { data: saved } = await supabase
      .from('exercise_logs')
      .upsert({ ...entry, id: log.id }, { onConflict: 'exercise_id,log_date' })
      .select().single()
    setSaving(false)
    onSave({ ...log, sets: payload, ...(saved || {}) })
  }

  return (
    <div className="mt-2 pt-2 pb-1" style={{ borderTop: '1px solid var(--drawer-card-border)' }}>
      {wt === 'cable' && (
        <div className="flex items-center gap-2 mb-1">
          <span className="w-10 flex-shrink-0" />
          <span className="text-[10px] font-body text-os-muted w-16 text-center">Plates</span>
          <span className="text-[10px] font-body text-os-muted w-14 text-center">Mini</span>
          <span className="w-4 flex-shrink-0" />
          <span className="text-[10px] font-body text-os-muted w-16 text-center">Reps</span>
        </div>
      )}

      <div className="space-y-2">
        {sets.map((set, i) => {
          const errs = setErrors[i]
          const showingWeightNote = weightNotes.has(i)
          const firstErr = Object.entries(errs).find(([f]) => isTouched(i, f) && errs[f])
          return (
            <div key={i}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-os-muted w-10 flex-shrink-0 select-none">Set {i + 1}</span>

                {(wt === 'barbell' || wt === 'dumbbell') && (
                  <>
                    <div className="flex items-center gap-0.5">
                      <input type="text" inputMode="decimal" placeholder="kg" value={set.weight}
                        onChange={e => handleWeightInput(i, e.target.value)} onBlur={() => handleWeightBlur(i)}
                        className="drawer-input w-16" style={{ borderColor: borderColor(i, 'weight') }} />
                      <div className="flex flex-col ml-0.5">
                        <button type="button" onClick={() => adjustWeight(i, 2.5)}
                          className="text-[9px] text-os-muted hover:text-os-fg leading-none px-0.5 py-px select-none">▲</button>
                        <button type="button" onClick={() => adjustWeight(i, -2.5)}
                          className="text-[9px] text-os-muted hover:text-os-fg leading-none px-0.5 py-px select-none">▼</button>
                      </div>
                    </div>
                    <span className="text-xs text-os-muted select-none">×</span>
                    <input type="text" inputMode="numeric" placeholder="reps" value={set.reps}
                      onChange={e => handleIntInput(i, 'reps', e.target.value)} onBlur={() => touchField(i, 'reps')}
                      className="drawer-input w-16" style={{ borderColor: borderColor(i, 'reps') }} />
                  </>
                )}

                {wt === 'cable' && (
                  <>
                    <input type="text" inputMode="numeric" placeholder="1" value={set.plates}
                      onChange={e => handleIntInput(i, 'plates', e.target.value)} onBlur={() => touchField(i, 'plates')}
                      className="drawer-input w-16" style={{ borderColor: borderColor(i, 'plates') }} />
                    <input type="text" inputMode="numeric" placeholder="0" value={set.mini}
                      onChange={e => handleMiniInput(i, e.target.value)} onBlur={() => touchField(i, 'mini')}
                      className="drawer-input w-14" style={{ borderColor: borderColor(i, 'mini') }} />
                    <span className="text-xs text-os-muted select-none">×</span>
                    <input type="text" inputMode="numeric" placeholder="reps" value={set.reps}
                      onChange={e => handleIntInput(i, 'reps', e.target.value)} onBlur={() => touchField(i, 'reps')}
                      className="drawer-input w-16" style={{ borderColor: borderColor(i, 'reps') }} />
                  </>
                )}

                {wt === 'reps' && (
                  <input type="text" inputMode="numeric" placeholder="reps" value={set.reps}
                    onChange={e => handleIntInput(i, 'reps', e.target.value)} onBlur={() => touchField(i, 'reps')}
                    className="drawer-input w-28" style={{ borderColor: borderColor(i, 'reps') }} />
                )}

                {wt === 'time' && (
                  <>
                    <input type="text" inputMode="numeric" placeholder="mm" value={set.mins}
                      onChange={e => handleMinsInput(i, e.target.value)} onBlur={() => touchField(i, 'mins')}
                      className="drawer-input w-16" style={{ borderColor: borderColor(i, 'mins') }} />
                    <span className="text-xs text-os-muted select-none">:</span>
                    <input type="text" inputMode="numeric" placeholder="ss" value={set.secs}
                      onChange={e => handleSecsInput(i, e.target.value)} className="drawer-input w-16" />
                  </>
                )}
              </div>

              {showingWeightNote && (
                <p className="text-[11px] font-body text-amber-500 ml-12 mt-0.5">Rounded to nearest 2.5 kg</p>
              )}
              {miniNote?.setIdx === i && (
                <p className="text-[11px] font-body text-amber-500 ml-12 mt-0.5">Max 2 mini-plates</p>
              )}
              {firstErr && !showingWeightNote && (
                <p className="text-[11px] font-body text-red-500 ml-12 mt-0.5">{firstErr[1]}</p>
              )}
            </div>
          )
        })}
      </div>

      {timeCapNote && (
        <p className="text-[11px] font-body text-amber-500 mt-1 ml-12">Maximum duration is 60 minutes</p>
      )}

      <div className="flex gap-3 mt-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg text-sm font-body font-medium text-os-secondary transition-colors hover:text-os-fg"
          style={{ border: '1px solid var(--drawer-card-border)' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2 rounded-lg text-sm font-body font-semibold transition-all disabled:opacity-60"
          style={showBlockStyle ? {
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#EF4444',
          } : { background: '#6366F1', color: 'white' }}
        >
          {saving ? 'Saving…' : showBlockStyle ? 'Fix errors above' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

// ── Exercise card for history view ───────────────────────────────────────────

function HistoryExerciseCard({ exercise, logs, dateFilter, editState, onOpenGraph, onStartEdit, onSaveEdit, onCancelEdit, onDelete }) {
  const wt = exercise.weight_type
  const today = todayStr()
  const mostRecent = logs[0] ?? null
  const days = daysSince(mostRecent?.log_date ?? null)

  const displayLogs = dateFilter === 'today'
    ? logs.filter(l => l.log_date === today)
    : logs.slice(0, 5)

  // Consistent: 7+ sessions in last 30 days
  const d30 = new Date(); d30.setDate(d30.getDate() - 30)
  const d30str = getLocalDateString(d30)
  const last30Count = logs.filter(l => l.log_date >= d30str).length
  const isConsistent = last30Count >= 7

  // Neglected: 14+ days since last session
  const isNeglected = days !== null && days >= 14

  // Fix 7B: compute all cumulative PR session dates (each time a new record was set)
  const prSessionDates = (() => {
    if (wt !== 'barbell' && wt !== 'dumbbell' && wt !== 'cable' && wt !== 'reps') return new Set()
    const sorted = [...logs].sort((a, b) => a.log_date < b.log_date ? -1 : 1)
    const dates = new Set()
    let maxSoFar = 0
    for (const l of sorted) {
      const v = getMaxValFromLog(l, wt)
      if (v > maxSoFar) { maxSoFar = v; dates.add(l.log_date) }
    }
    return dates
  })()

  // Card-level PR indicator: most recent session was a PR
  const latestIsPR = prSessionDates.has(logs[0]?.log_date)

  const cardBorderStyle = isNeglected
    ? { border: '1px solid rgba(239,68,68,0.45)' }
    : latestIsPR
    ? { border: '1px solid var(--drawer-card-border)', borderLeft: '3px solid rgba(245,158,11,0.6)' }
    : { border: '1px solid var(--drawer-card-border)' }

  return (
    <div
      className="relative rounded-xl p-4"
      style={{
        background: isConsistent
          ? 'linear-gradient(135deg, rgba(245,158,11,0.06), var(--drawer-card-bg))'
          : 'var(--drawer-card-bg)',
        ...cardBorderStyle,
      }}
    >
      {/* Fix MISSED: neglected pulsing left border (opacity-based, not scale) */}
      {isNeglected && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          borderRadius: '12px 0 0 12px',
          background: '#EF4444',
          animation: 'neglectedPulse 2s ease-in-out infinite',
        }} />
      )}
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
          {/* Fix MISSED: "Consistent 🔥" amber text label + days-since on same line */}
          <p className="text-xs font-body mt-0.5">
            <span style={{ color: isNeglected ? '#EF4444' : 'var(--os-muted)' }}>{daysLabel(days)}</span>
            {isConsistent && (
              <span style={{ color: '#F59E0B', marginLeft: 8, fontSize: 11 }}>Consistent 🔥 {last30Count}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={onOpenGraph}
            className="p-1.5 rounded-md text-os-muted hover:text-os-indigo transition-colors"
            title="View progress graph"
          >
            <i className="ti ti-chart-line text-sm" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-os-muted hover:text-red-500 transition-colors"
            title="Delete exercise"
          >
            <i className="ti ti-trash text-sm" />
          </button>
        </div>
      </div>

      {displayLogs.length === 0 ? (
        <p className="text-xs font-body text-os-muted">
          {dateFilter === 'today' ? 'No workout logged today' : 'No sessions logged yet'}
        </p>
      ) : (
        <div className="space-y-1.5">
          {displayLogs.map(log => {
            const isEditing = editState?.exerciseId === exercise.id && editState?.logId === log.id
            const isToday = log.log_date === today
            const isPRSession = prSessionDates.has(log.log_date)
            return (
              <div key={log.id}>
                <div
                  className="flex items-center gap-2 text-xs font-body rounded-lg px-2 py-1"
                  style={isToday ? {
                    border: '1px solid rgba(16,185,129,0.45)',
                    background: 'rgba(16,185,129,0.04)',
                    boxShadow: '0 0 10px rgba(16,185,129,0.08)',
                  } : isPRSession ? {
                    border: '1px solid rgba(245,158,11,0.35)',
                    background: 'rgba(245,158,11,0.04)',
                  } : {}}
                >
                  <span className="text-os-muted flex-shrink-0 w-12">{fmtDate(log.log_date)}</span>
                  {isToday && (
                    <span className="text-[9px] font-mono px-1 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>Today</span>
                  )}
                  {isPRSession && !isToday && (
                    <i className="ti ti-trophy text-[11px] flex-shrink-0" style={{ color: '#F59E0B' }} />
                  )}
                  <span className="text-os-secondary flex-1 min-w-0 truncate">{fmtSets(log, wt)}</span>
                  {!isEditing && (
                    <button
                      onClick={() => onStartEdit(exercise.id, log.id, log)}
                      className="p-0.5 rounded text-os-muted hover:text-os-fg transition-colors flex-shrink-0 ml-1"
                      title="Edit session"
                    >
                      <i className="ti ti-pencil text-xs" />
                    </button>
                  )}
                </div>
                {isEditing && (
                  <InlineSessionEditor
                    log={log}
                    exercise={exercise}
                    onSave={updatedLog => onSaveEdit(exercise.id, updatedLog)}
                    onCancel={onCancelEdit}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main drawer ──────────────────────────────────────────────────────────────

export default function HistoryDrawer({ onClose }) {
  const [activeType, setActiveType]   = useState('Push')
  const [dateFilter, setDateFilter]   = useState('all')
  const [exercises, setExercises]     = useState([])
  const [logs, setLogs]               = useState({})
  const [loading, setLoading]         = useState(true)
  const [graphExercise, setGraphExercise] = useState(null)
  const [editState, setEditState]     = useState(null)  // { exerciseId, logId, log }
  const [deleteTarget, setDeleteTarget] = useState(null) // { exercise, hasPriorLogs, bodyText }

  useEffect(() => { fetchForType(activeType) }, [activeType])

  async function fetchForType(type) {
    setLoading(true)
    setEditState(null)
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

  function handleStartEdit(exerciseId, logId, log) {
    setEditState({ exerciseId, logId, log })
  }

  function handleSaveEdit(exerciseId, updatedLog) {
    setLogs(prev => ({
      ...prev,
      [exerciseId]: (prev[exerciseId] || []).map(l => l.id === updatedLog.id ? updatedLog : l),
    }))
    setEditState(null)
  }

  async function handleDeleteInit(exercise) {
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

  async function confirmDelete() {
    const { exercise, hasPriorLogs } = deleteTarget
    const today = todayStr()

    if (!hasPriorLogs) {
      await supabase.from('exercises').delete().eq('id', exercise.id)
      setExercises(prev => prev.filter(e => e.id !== exercise.id))
      setLogs(prev => { const n = { ...prev }; delete n[exercise.id]; return n })
    } else {
      await supabase.from('exercise_logs').delete()
        .eq('exercise_id', exercise.id).eq('log_date', today)
      setLogs(prev => ({
        ...prev,
        [exercise.id]: (prev[exercise.id] || []).filter(l => l.log_date !== today),
      }))
    }

    if (editState?.exerciseId === exercise.id) setEditState(null)
    setDeleteTarget(null)
  }

  // Fix 2: hide exercise cards that have no log for today when "Today" is active
  const today = todayStr()
  const visibleExercises = dateFilter === 'today'
    ? exercises.filter(ex => (logs[ex.id] || []).some(l => l.log_date === today))
    : exercises

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
          <h2 className="font-display font-semibold text-base text-os-fg">Workout History</h2>
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

        {/* Date filter */}
        <div className="flex items-center gap-1 px-4 py-2 flex-shrink-0">
          {[{ key: 'all', label: 'All time' }, { key: 'today', label: 'Today' }].map(opt => (
            <button
              key={opt.key}
              onClick={() => { setDateFilter(opt.key); setEditState(null) }}
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
          ) : visibleExercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <i className="ti ti-dumbbell text-3xl text-os-muted" />
              <span className="text-sm font-body text-os-muted text-center px-8">
                {dateFilter === 'today'
                  ? `No ${activeType} exercises logged today`
                  : `No exercises in ${activeType} yet`}
              </span>
            </div>
          ) : (
            visibleExercises.map(ex => (
              <HistoryExerciseCard
                key={ex.id}
                exercise={ex}
                logs={logs[ex.id] || []}
                dateFilter={dateFilter}
                editState={editState}
                onOpenGraph={() => setGraphExercise(ex)}
                onStartEdit={handleStartEdit}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditState(null)}
                onDelete={() => handleDeleteInit(ex)}
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

      {deleteTarget && (
        <DeleteConfirmModal
          exercise={deleteTarget.exercise}
          bodyText={deleteTarget.bodyText}
          confirmText={deleteTarget.hasPriorLogs ? "Delete today's log" : 'Delete permanently'}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
}
