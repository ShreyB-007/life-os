/*
 * QA fixes applied:
 * - Integer-only inputs (type=text inputMode=numeric + strip on change)
 * - Field validation with red/green borders; Log blocked until all valid
 * - Cable type uses plates/mini/reps instead of kg/reps
 * - Mini-plates capped at 2 with inline note
 * - Time auto-converts SS>=60 into minutes; caps at 59m 59s
 * - Workout-type tag affordance lets exercise appear in other drawers
 * - Fix 1: Tag picker dropdown via React portal to avoid overflow:hidden clipping
 * - Fix 3: Barbell/dumbbell weight in multiples of 2.5; auto-round on blur; ▲/▼ step buttons
 */
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/date'
import { ALL_WORKOUT_TYPES } from '../lib/exercise'

function daysSince(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  return Math.floor((today - d) / 86400000)
}

function formatLastSession(log, wt) {
  if (!log?.sets?.length) return null
  const s = log.sets
  if (wt === 'barbell' || wt === 'dumbbell') {
    return s.map(x => `${x.weight}kg×${x.reps}`).join(' / ')
  }
  if (wt === 'cable') {
    return s.map(x =>
      x.plates !== undefined
        ? `P${x.plates} M${x.mini} ×${x.reps}`
        : `${x.weight}kg×${x.reps}`
    ).join(' / ')
  }
  if (wt === 'reps') return s.map(x => `${x.reps} reps`).join(' / ')
  if (wt === 'time') {
    return s.map(x => {
      const total = x.duration || 0
      const m = Math.floor(total / 60)
      const sec = total % 60
      return m > 0 ? `${m}m${sec > 0 ? sec + 's' : ''}` : `${sec}s`
    }).join(' / ')
  }
  return null
}

function defaultSets(wt) {
  const empty3 = Array.from({ length: 3 })
  if (wt === 'barbell' || wt === 'dumbbell') return empty3.map(() => ({ weight: '', reps: '' }))
  if (wt === 'cable') return empty3.map(() => ({ plates: '', mini: '', reps: '' }))
  if (wt === 'reps') return empty3.map(() => ({ reps: '' }))
  return empty3.map(() => ({ mins: '', secs: '' }))
}

function setsFromLog(log, wt) {
  if (!log?.sets?.length) return defaultSets(wt)
  const s = log.sets
  if (wt === 'cable') {
    return s.map(x =>
      x.plates !== undefined
        ? { plates: String(x.plates ?? ''), mini: String(x.mini ?? ''), reps: String(x.reps ?? '') }
        : { plates: '', mini: '', reps: String(x.reps ?? '') }
    )
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

function emptySetRow(wt) {
  if (wt === 'barbell' || wt === 'dumbbell') return { weight: '', reps: '' }
  if (wt === 'cable') return { plates: '', mini: '', reps: '' }
  if (wt === 'reps') return { reps: '' }
  return { mins: '', secs: '' }
}

function roundTo2p5(val) {
  return Math.round(val / 2.5) * 2.5
}

function isMultipleOf2p5(val) {
  return Math.abs(roundTo2p5(val) - val) < 0.001
}

function validateSet(set, wt) {
  const errors = {}
  if (wt === 'barbell' || wt === 'dumbbell') {
    const w = parseFloat(set.weight)
    const r = parseInt(set.reps)
    if (isNaN(w) || w < 2.5)       errors.weight = 'Min 2.5 kg'
    else if (!isMultipleOf2p5(w))  errors.weight = 'Must be a multiple of 2.5 kg'
    if (isNaN(r) || r < 1)         errors.reps   = 'Reps must be at least 1'
  } else if (wt === 'cable') {
    const p = parseInt(set.plates), m = parseInt(set.mini), r = parseInt(set.reps)
    if (isNaN(p) || p < 1)         errors.plates = 'Plates must be at least 1'
    if (isNaN(m) || m < 0)         errors.mini   = 'Min 0'
    else if (m > 2)                 errors.mini   = 'Max 2 mini-plates'
    if (isNaN(r) || r < 1)         errors.reps   = 'Reps must be at least 1'
  } else if (wt === 'reps') {
    const r = parseInt(set.reps)
    if (isNaN(r) || r < 1)         errors.reps   = 'Reps must be at least 1'
  } else if (wt === 'time') {
    const total = (parseInt(set.mins) || 0) * 60 + (parseInt(set.secs) || 0)
    if (total <= 0)                 errors.mins   = 'Duration must be greater than 0'
  }
  return errors
}

function stripInt(val) {
  return val.replace(/[^0-9]/g, '')
}

function stripWeight(val) {
  // Allow digits and one decimal point only
  return val.replace(/[^0-9.]/g, '').replace(/^(\d*\.?\d*).*$/, '$1')
}

export default function ExerciseCard({
  exercise, logs, expanded, onToggle, onCollapse,
  onLogSave, onOpenGraph, onDelete, onAddTag,
}) {
  const today = todayStr()
  const wt = exercise.weight_type

  const todayLog   = logs.find(l => l.log_date === today) ?? null
  const lastLog    = logs.find(l => l.log_date !== today) ?? null
  const mostRecent = logs[0] ?? null

  const [sets, setSets]                       = useState(() => setsFromLog(todayLog, wt))
  const [saved, setSaved]                     = useState(!!todayLog)
  const [saving, setSaving]                   = useState(false)
  const [touched, setTouched]                 = useState(new Set())
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [showTagPicker, setShowTagPicker]     = useState(false)
  const [tagDropdownPos, setTagDropdownPos]   = useState(null)
  const [miniNote, setMiniNote]               = useState(null)
  const [timeCapNote, setTimeCapNote]         = useState(false)
  const [weightNotes, setWeightNotes]         = useState(new Set())

  const tagBtnRef      = useRef(null)
  const tagDropdownRef = useRef(null)

  useEffect(() => {
    setSets(setsFromLog(todayLog, wt))
    setSaved(!!todayLog)
    setTouched(new Set())
    setSubmitAttempted(false)
  }, [todayLog?.log_date])

  useEffect(() => {
    if (!showTagPicker) return
    function onOutside(e) {
      if (tagBtnRef.current?.contains(e.target)) return
      if (tagDropdownRef.current?.contains(e.target)) return
      setShowTagPicker(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [showTagPicker])

  const days = daysSince(mostRecent?.log_date ?? null)
  const daysLabel = days === null ? 'Never done'
    : days === 0   ? 'Done today'
    : days === 1   ? 'Yesterday'
    : `${days} days ago`
  const daysWarning = days !== null && days >= 14

  const setErrors      = sets.map(s => validateSet(s, wt))
  const formValid      = setErrors.every(e => Object.keys(e).length === 0)
  const showBlockStyle = submitAttempted && !formValid

  function isTouched(setIdx, field) {
    return touched.has(`${setIdx}-${field}`) || submitAttempted
  }

  function borderColor(setIdx, field) {
    if (!isTouched(setIdx, field)) return 'var(--drawer-card-border)'
    return setErrors[setIdx]?.[field] ? '#EF4444' : '#10B981'
  }

  function touchField(setIdx, field) {
    setTouched(prev => new Set([...prev, `${setIdx}-${field}`]))
  }

  function updateSet(idx, field, value) {
    setSets(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
    setSaved(false)
  }

  function updateSetMulti(idx, updates) {
    setSets(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s))
    setSaved(false)
  }

  function handleIntInput(idx, field, raw) {
    updateSet(idx, field, stripInt(raw))
  }

  function handleWeightInput(idx, raw) {
    updateSet(idx, 'weight', stripWeight(raw))
  }

  function handleWeightBlur(idx) {
    touchField(idx, 'weight')
    const raw = sets[idx].weight
    const val = parseFloat(raw)
    let rounded
    if (!raw || isNaN(val) || val <= 0) {
      rounded = 2.5
    } else {
      rounded = Math.max(2.5, roundTo2p5(val))
    }
    if (!raw || Math.abs(rounded - (isNaN(val) ? 0 : val)) > 0.001) {
      updateSet(idx, 'weight', String(rounded))
      setWeightNotes(prev => new Set([...prev, idx]))
      setTimeout(() => setWeightNotes(prev => { const n = new Set(prev); n.delete(idx); return n }), 2500)
    }
  }

  function adjustWeight(idx, delta) {
    const cur = parseFloat(sets[idx].weight) || 0
    const next = Math.max(2.5, roundTo2p5(cur + delta))
    updateSet(idx, 'weight', String(next))
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
      setTimeCapNote(true)
      setTimeout(() => setTimeCapNote(false), 2500)
    } else {
      updateSet(idx, 'mins', stripped)
    }
  }

  function handleSecsInput(idx, raw) {
    const stripped = stripInt(raw)
    const num = parseInt(stripped) || 0
    if (num >= 60) {
      const carry = Math.floor(num / 60)
      const newSecs = num % 60
      const curMins = parseInt(sets[idx].mins) || 0
      const newMins = curMins + carry
      if (newMins > 59) {
        updateSetMulti(idx, { mins: '59', secs: String(newSecs) })
        setTimeCapNote(true)
        setTimeout(() => setTimeCapNote(false), 2500)
      } else {
        updateSetMulti(idx, { mins: String(newMins), secs: String(newSecs) })
      }
    } else {
      updateSet(idx, 'secs', stripped)
    }
  }

  function addSet() {
    setSets(prev => [...prev, emptySetRow(wt)])
    setSaved(false)
  }

  function removeSet() {
    if (sets.length <= 1) return
    setSets(prev => prev.slice(0, -1))
    setSaved(false)
  }

  function buildPayload() {
    return sets.map(s => {
      if (wt === 'barbell' || wt === 'dumbbell') return { weight: parseFloat(s.weight) || 0, reps: parseInt(s.reps) || 0 }
      if (wt === 'cable') return { plates: parseInt(s.plates) || 0, mini: parseInt(s.mini) || 0, reps: parseInt(s.reps) || 0 }
      if (wt === 'reps') return { reps: parseInt(s.reps) || 0 }
      return { duration: (parseInt(s.mins) || 0) * 60 + (parseInt(s.secs) || 0) }
    })
  }

  async function handleLog() {
    setSubmitAttempted(true)
    if (!formValid) return
    const payload = buildPayload()
    const entry = { exercise_id: exercise.id, log_date: today, sets: payload, logged_at: new Date().toISOString() }
    onLogSave({ ...entry, id: todayLog?.id ?? `opt-${Date.now()}` })
    setSaving(true)
    setSaved(true)
    await supabase.from('exercise_logs').upsert(entry, { onConflict: 'exercise_id,log_date' })
    setSaving(false)
    setTimeout(() => onCollapse(), 1500)
  }

  function openTagPicker(e) {
    e.stopPropagation()
    if (showTagPicker) { setShowTagPicker(false); return }
    const rect = tagBtnRef.current.getBoundingClientRect()
    setTagDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setShowTagPicker(true)
  }

  const availableTags = ALL_WORKOUT_TYPES.filter(t => !(exercise.workout_type_tags || []).includes(t))

  return (
    <div
      className={['rounded-xl overflow-hidden transition-all duration-200', expanded ? '' : 'card-interactive cursor-pointer'].join(' ')}
      style={{ background: expanded ? 'var(--drawer-card-bg-exp)' : 'var(--drawer-card-bg)', border: '1px solid var(--drawer-card-border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-sm text-os-fg truncate">{exercise.name}</span>
            {saved && <i className="ti ti-circle-check text-emerald-500 text-sm flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={['text-xs font-body', daysWarning ? 'text-amber-500' : 'text-os-muted'].join(' ')}>{daysLabel}</span>
            <span className="text-xs text-os-muted opacity-50">·</span>
            <span className="text-xs font-body text-os-muted capitalize">{wt}</span>
          </div>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
          {availableTags.length > 0 && (
            <button
              ref={tagBtnRef}
              onClick={openTagPicker}
              className="p-2 rounded-md text-os-muted hover:text-os-indigo transition-colors"
              title="Also show in another workout type"
            >
              <i className="ti ti-tag-plus text-sm" />
            </button>
          )}
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
          <i className={['ti text-sm text-os-muted transition-transform duration-200 mr-0.5', expanded ? 'ti-chevron-up' : 'ti-chevron-down'].join(' ')} />
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--drawer-card-border)' }}>
          {lastLog && (
            <div className="mt-3 mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--drawer-ref-bg)' }}>
              <p className="text-xs font-body text-os-muted">
                Last ({lastLog.log_date}):{' '}
                <span className="text-os-secondary">{formatLastSession(lastLog, wt) || '—'}</span>
              </p>
            </div>
          )}

          {wt === 'cable' && (
            <div className="flex items-center gap-2 mb-1 mt-3">
              <span className="w-10 flex-shrink-0" />
              <span className="text-[10px] font-body text-os-muted w-16 text-center">Plates</span>
              <span className="text-[10px] font-body text-os-muted w-14 text-center">Mini</span>
              <span className="w-4 flex-shrink-0" />
              <span className="text-[10px] font-body text-os-muted w-16 text-center">Reps</span>
            </div>
          )}

          <div className={['space-y-2', wt !== 'cable' ? 'mt-3' : ''].join(' ')}>
            {sets.map((set, i) => {
              const errs = setErrors[i]
              const firstErr = Object.entries(errs).find(([f]) => isTouched(i, f) && errs[f])
              const showingWeightNote = weightNotes.has(i)
              return (
                <div key={i}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-os-muted w-10 flex-shrink-0 select-none">Set {i + 1}</span>

                    {(wt === 'barbell' || wt === 'dumbbell') && (
                      <>
                        <div className="flex items-center gap-0.5">
                          <input
                            type="text" inputMode="decimal" placeholder="kg"
                            value={set.weight}
                            onChange={e => handleWeightInput(i, e.target.value)}
                            onBlur={() => handleWeightBlur(i)}
                            className="drawer-input w-16"
                            style={{ borderColor: borderColor(i, 'weight') }}
                          />
                          <div className="flex flex-col ml-0.5">
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); adjustWeight(i, 2.5) }}
                              className="text-[9px] text-os-muted hover:text-os-fg leading-none px-0.5 py-px select-none"
                            >▲</button>
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); adjustWeight(i, -2.5) }}
                              className="text-[9px] text-os-muted hover:text-os-fg leading-none px-0.5 py-px select-none"
                            >▼</button>
                          </div>
                        </div>
                        <span className="text-xs text-os-muted select-none">×</span>
                        <input
                          type="text" inputMode="numeric" placeholder="reps"
                          value={set.reps}
                          onChange={e => handleIntInput(i, 'reps', e.target.value)}
                          onBlur={() => touchField(i, 'reps')}
                          className="drawer-input w-16"
                          style={{ borderColor: borderColor(i, 'reps') }}
                        />
                      </>
                    )}

                    {wt === 'cable' && (
                      <>
                        <input
                          type="text" inputMode="numeric" placeholder="1"
                          value={set.plates}
                          onChange={e => handleIntInput(i, 'plates', e.target.value)}
                          onBlur={() => touchField(i, 'plates')}
                          className="drawer-input w-16"
                          style={{ borderColor: borderColor(i, 'plates') }}
                        />
                        <input
                          type="text" inputMode="numeric" placeholder="0"
                          value={set.mini}
                          onChange={e => handleMiniInput(i, e.target.value)}
                          onBlur={() => touchField(i, 'mini')}
                          className="drawer-input w-14"
                          style={{ borderColor: borderColor(i, 'mini') }}
                        />
                        <span className="text-xs text-os-muted select-none">×</span>
                        <input
                          type="text" inputMode="numeric" placeholder="reps"
                          value={set.reps}
                          onChange={e => handleIntInput(i, 'reps', e.target.value)}
                          onBlur={() => touchField(i, 'reps')}
                          className="drawer-input w-16"
                          style={{ borderColor: borderColor(i, 'reps') }}
                        />
                      </>
                    )}

                    {wt === 'reps' && (
                      <input
                        type="text" inputMode="numeric" placeholder="reps"
                        value={set.reps}
                        onChange={e => handleIntInput(i, 'reps', e.target.value)}
                        onBlur={() => touchField(i, 'reps')}
                        className="drawer-input w-28"
                        style={{ borderColor: borderColor(i, 'reps') }}
                      />
                    )}

                    {wt === 'time' && (
                      <>
                        <input
                          type="text" inputMode="numeric" placeholder="mm"
                          value={set.mins}
                          onChange={e => handleMinsInput(i, e.target.value)}
                          onBlur={() => touchField(i, 'mins')}
                          className="drawer-input w-16"
                          style={{ borderColor: borderColor(i, 'mins') }}
                        />
                        <span className="text-xs text-os-muted select-none">:</span>
                        <input
                          type="text" inputMode="numeric" placeholder="ss"
                          value={set.secs}
                          onChange={e => handleSecsInput(i, e.target.value)}
                          className="drawer-input w-16"
                        />
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

          <div className="flex gap-4 mt-3">
            <button
              onClick={removeSet}
              disabled={sets.length <= 1}
              className="text-xs font-body text-os-muted hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              − Remove set
            </button>
            <button onClick={addSet} className="text-xs font-body text-os-muted hover:text-os-fg transition-colors">
              + Add set
            </button>
          </div>

          <button
            onClick={handleLog}
            disabled={saving}
            className="mt-4 w-full py-2 rounded-lg text-sm font-body font-semibold transition-all disabled:opacity-60"
            style={saved ? {
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)',
              color: '#10B981',
            } : showBlockStyle ? {
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#EF4444',
            } : {
              background: '#6366F1',
              border: 'none',
              color: 'white',
            }}
          >
            {saving ? 'Saving…' : saved ? '✓ Logged' : showBlockStyle ? 'Fix errors above' : 'Log workout'}
          </button>
        </div>
      )}

      {/* Tag picker — portal-mounted to escape overflow:hidden on ancestor containers */}
      {showTagPicker && tagDropdownPos && createPortal(
        <div
          ref={tagDropdownRef}
          className="rounded-lg shadow-lg p-1"
          style={{
            position: 'fixed',
            top: tagDropdownPos.top,
            right: tagDropdownPos.right,
            zIndex: 500,
            minWidth: 130,
            background: 'var(--drawer-bg)',
            border: '1px solid var(--drawer-card-border)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <p className="text-[10px] font-body text-os-muted px-2 py-1 uppercase tracking-wide">Also show in</p>
          {availableTags.map(type => (
            <button
              key={type}
              onClick={e => { e.stopPropagation(); onAddTag(exercise.id, type); setShowTagPicker(false) }}
              className="w-full text-left text-xs font-body px-2 py-1.5 rounded hover:text-os-fg text-os-secondary transition-colors"
            >
              {type}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
