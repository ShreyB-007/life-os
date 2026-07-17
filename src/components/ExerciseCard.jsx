import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { getLocalDateString } from '../lib/dateUtils'
import { ALL_WORKOUT_TYPES } from '../lib/exercise'

// ── Particle burst ────────────────────────────────────────────────────────────
function spawnParticles(originEl, isPR) {
  if (!originEl) return
  const rect = originEl.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const count = isPR ? 20 : 10
  const palette = isPR
    ? ['#6366F1', '#10B981', '#F59E0B', '#EAB308', '#10B981']
    : ['#6366F1', '#10B981', '#F59E0B']

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6
    const dist = 38 + Math.random() * 42
    const color = palette[i % palette.length]
    const sz = 4 + Math.floor(Math.random() * 3)
    const el = document.createElement('div')
    el.style.cssText = `position:fixed;width:${sz}px;height:${sz}px;border-radius:50%;background:${color};left:${cx}px;top:${cy}px;pointer-events:none;z-index:9999;will-change:transform,opacity;`
    document.body.appendChild(el)
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist
    const startTime = performance.now()
    function tick(now) {
      const t = Math.min((now - startTime) / 600, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      el.style.transform = `translate(${(-sz / 2 + dx * eased).toFixed(1)}px, ${(-sz / 2 + dy * eased).toFixed(1)}px)`
      el.style.opacity = (1 - t).toFixed(2)
      if (t < 1) requestAnimationFrame(tick)
      else el.remove()
    }
    requestAnimationFrame(tick)
  }
}

// ── Form utilities ────────────────────────────────────────────────────────────
function roundTo2p5(val) { return Math.round(val / 2.5) * 2.5 }
function isMultipleOf2p5(val) { return Math.abs(roundTo2p5(val) - val) < 0.001 }
function stripInt(val) { return val.replace(/[^0-9]/g, '') }
function stripWeight(val) { return val.replace(/[^0-9.]/g, '').replace(/^(\d*\.?\d*).*$/, '$1') }

function normalizeCableSet(set = {}) {
  return {
    big: String(set.big ?? set.plates ?? ''),
    medium: String(set.medium ?? 0),
    small: String(set.small ?? set.mini ?? ''),
    reps: String(set.reps ?? ''),
  }
}

function cableWeight(set = {}) {
  return (parseInt(set.big ?? set.plates) || 0) * 7
    + (parseInt(set.medium) || 0) * 5
    + (parseInt(set.small ?? set.mini) || 0) * 2.3
}

function formatCableSet(set) {
  const normalized = normalizeCableSet(set)
  return `${normalized.big}B + ${normalized.medium}M + ${normalized.small}S ×${normalized.reps}`
}

function validateSet(set, wt) {
  const errors = {}
  if (wt === 'barbell' || wt === 'dumbbell') {
    const w = parseFloat(set.weight), r = parseInt(set.reps)
    if (isNaN(w) || w < 2.5)       errors.weight = 'Min 2.5 kg'
    else if (!isMultipleOf2p5(w))  errors.weight = 'Must be a multiple of 2.5 kg'
    if (isNaN(r) || r < 1)         errors.reps   = 'Reps must be at least 1'
  } else if (wt === 'cable') {
    const b = parseInt(set.big), m = parseInt(set.medium), s = parseInt(set.small), r = parseInt(set.reps)
    if (isNaN(b) || b < 1)  errors.big = 'Big plates must be at least 1'
    if (isNaN(m) || m < 0)  errors.medium = 'Min 0'
    if (isNaN(s) || s < 0)  errors.small = 'Min 0'
    else if (s > 2)         errors.small = 'Max 2 small plates'
    if (isNaN(r) || r < 1)  errors.reps = 'Reps must be at least 1'
  } else if (wt === 'reps') {
    const r = parseInt(set.reps)
    if (isNaN(r) || r < 1)  errors.reps = 'Reps must be at least 1'
  } else if (wt === 'time') {
    const total = (parseInt(set.mins) || 0) * 60 + (parseInt(set.secs) || 0)
    if (total <= 0)          errors.mins = 'Duration must be greater than 0'
  }
  return errors
}

function isSetComplete(set, wt) {
  if (wt === 'barbell' || wt === 'dumbbell') {
    const w = parseFloat(set.weight), r = parseInt(set.reps)
    return !isNaN(w) && w >= 2.5 && isMultipleOf2p5(w) && !isNaN(r) && r >= 1
  }
  if (wt === 'cable') {
    const b = parseInt(set.big), m = parseInt(set.medium), s = parseInt(set.small), r = parseInt(set.reps)
    return !isNaN(b) && b >= 1 && !isNaN(m) && m >= 0 && !isNaN(s) && s >= 0 && s <= 2 && !isNaN(r) && r >= 1
  }
  if (wt === 'reps') return !isNaN(parseInt(set.reps)) && parseInt(set.reps) >= 1
  return (parseInt(set.mins) || 0) * 60 + (parseInt(set.secs) || 0) > 0
}

// Fix 6: default to 1 set with 0 as placeholder values
function defaultSets(wt) {
  if (wt === 'barbell' || wt === 'dumbbell') return [{ weight: '0', reps: '0' }]
  if (wt === 'cable')  return [{ big: '0', medium: '0', small: '0', reps: '0' }]
  if (wt === 'reps')   return [{ reps: '0' }]
  return [{ mins: '0', secs: '0' }]
}

function emptySetRow(wt) {
  if (wt === 'barbell' || wt === 'dumbbell') return { weight: '0', reps: '0' }
  if (wt === 'cable') return { big: '0', medium: '0', small: '0', reps: '0' }
  if (wt === 'reps') return { reps: '0' }
  return { mins: '0', secs: '0' }
}

function setsFromLog(log, wt) {
  if (!log?.sets?.length) return defaultSets(wt)
  const s = log.sets
  if (wt === 'cable') {
    return s.map(x => normalizeCableSet(x))
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

function formatLastSession(log, wt) {
  if (!log?.sets?.length) return null
  const s = log.sets
  if (wt === 'barbell' || wt === 'dumbbell') return s.map(x => `${x.weight}kg×${x.reps}`).join(' / ')
  if (wt === 'cable') return s.map(x => (x.big !== undefined || x.plates !== undefined) ? formatCableSet(x) : `${x.weight}kg×${x.reps}`).join(' / ')
  if (wt === 'reps') return s.map(x => `${x.reps} reps`).join(' / ')
  if (wt === 'time') {
    return s.map(x => {
      const total = x.duration || 0; const m = Math.floor(total / 60); const sec = total % 60
      return m > 0 ? `${m}m${sec > 0 ? sec + 's' : ''}` : `${sec}s`
    }).join(' / ')
  }
  return null
}

// ── PR detection helpers ──────────────────────────────────────────────────────
// Live form value (sets currently being typed — time uses mins/secs strings)
function getSingleVal(s, wt) {
  if (wt === 'barbell' || wt === 'dumbbell') return parseFloat(s.weight) || 0
  if (wt === 'cable') return cableWeight(s)
  if (wt === 'reps') return parseInt(s.reps) || 0
  if (wt === 'time') return (parseInt(s.mins) || 0) * 60 + (parseInt(s.secs) || 0)
  return 0
}

// Saved/payload value (DB format — time uses a single duration field)
function getSavedVal(s, wt) {
  if (wt === 'time') return s.duration || 0
  return getSingleVal(s, wt)
}

function getMaxFromLog(log, wt) {
  if (!log?.sets?.length) return 0
  return Math.max(0, ...log.sets.map(s => getSavedVal(s, wt)))
}

function getMaxFromSets(sets, wt) {
  if (!sets?.length) return 0
  return Math.max(0, ...sets.map(s => getSavedVal(s, wt)))
}

// ── Days-since urgency ────────────────────────────────────────────────────────
function daysSince(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.floor((today - new Date(dateStr + 'T00:00:00')) / 86400000)
}

function getDaysStyle(days) {
  if (days === null) return { color: 'var(--os-muted)', label: 'Never done', pulse: false }
  if (days === 0) return { color: '#10B981', label: 'Done today ✓', pulse: false }
  if (days <= 3) return { color: '#22C55E', label: `${days} day${days === 1 ? '' : 's'} ago`, pulse: false }
  if (days <= 7) return { color: '#F59E0B', label: `${days} days ago`, pulse: false }
  if (days <= 13) return { color: '#F97316', label: `${days} days ago`, pulse: false }
  return { color: '#EF4444', label: `⚠️ ${days} days ago`, pulse: true }
}

export default function ExerciseCard({
  exercise, logs, allLogs = [], expanded, onToggle, onCollapse,
  onLogSave, onOpenGraph, onDeleteToday, onRemoveExercise, onAddTag,
  workoutType, selectedDate, viewOnly = false,
}) {
  const today = selectedDate
  const wt    = exercise.weight_type

  const todayLog   = logs.find(l => l.log_date === today) ?? null
  const lastLog    = logs.find(l => l.log_date !== today) ?? null
  const mostRecent = (allLogs.length > 0 ? allLogs : logs)[0] ?? null

  const [sets, setSets]                       = useState(() => setsFromLog(todayLog, wt))
  const [saved, setSaved]                     = useState(!!todayLog)
  const [saving, setSaving]                   = useState(false)
  const [touched, setTouched]                 = useState(new Set())
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [showTagPicker, setShowTagPicker]     = useState(false)
  const [tagDropdownPos, setTagDropdownPos]   = useState(null)
  const [smallNote, setSmallNote]             = useState(null)
  const [timeCapNote, setTimeCapNote]         = useState(false)
  const [weightNotes, setWeightNotes]         = useState(new Set())
  const [focusedDefaultZeros, setFocusedDefaultZeros] = useState(new Set())
  const [comparisonActive, setComparisonActive] = useState(false)
  const [prBadge, setPrBadge]                 = useState(false)
  const [prFlash, setPrFlash]                 = useState(false)
  const [shaking, setShaking]                 = useState(false)

  const tagBtnRef       = useRef(null)
  const tagDropdownRef  = useRef(null)
  const logBtnRef       = useRef(null)
  const weightRefs      = useRef({})  // idx → input DOM element
  const comparisonTimer = useRef(null)
  const prDebounceRef   = useRef(null)

  // Cached prior-session max, computed once when card expands (never re-fetches on keystrokes)
  const [priorMax, setPriorMax]             = useState(null)
  const [priorSessionCount, setPriorSessionCount] = useState(0)

  useEffect(() => {
    setSets(setsFromLog(todayLog, wt))
    setSaved(!!todayLog)
    setTouched(new Set())
    setFocusedDefaultZeros(new Set())
    setSubmitAttempted(false)
    setComparisonActive(false)
  }, [todayLog?.log_date, selectedDate, wt])

  // Collapsing without saving should drop the live-preview PR badge — otherwise an
  // abandoned edit that briefly looked like a PR keeps showing in the collapsed header.
  const wasExpanded = useRef(expanded)
  useEffect(() => {
    if (wasExpanded.current && !expanded && !saved) setPrBadge(false)
    wasExpanded.current = expanded
  }, [expanded, saved])

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

  // Compute priorMax once when card expands — avoid repeated DB calls on keystrokes
  useEffect(() => {
    if (!expanded) return
    const priorLogs = logs.filter(l => l.log_date !== today)
    setPriorSessionCount(priorLogs.length)
    if (priorLogs.length === 0) {
      setPriorMax(0)
    } else {
      const m = priorLogs.reduce((acc, l) => Math.max(acc, getMaxFromLog(l, wt)), 0)
      setPriorMax(m)
    }
  }, [expanded, logs, today, wt])

  // Live PR detection — debounced 300ms, runs on every input change
  useEffect(() => {
    if (!expanded || priorMax === null) return
    clearTimeout(prDebounceRef.current)
    prDebounceRef.current = setTimeout(() => {
      const currentMax = Math.max(0, ...sets.map(s => getSingleVal(s, wt)))
      const isPRLive = priorSessionCount === 0 || currentMax > priorMax
      setPrBadge(isPRLive)
    }, 300)
    return () => clearTimeout(prDebounceRef.current)
  }, [sets, priorMax, priorSessionCount, expanded])

  // ── Days-since + streak ───────────────────────────────────────────────────
  const days = daysSince(mostRecent?.log_date ?? null)
  const daysStyle = getDaysStyle(days)

  const d30 = new Date(); d30.setDate(d30.getDate() - 30)
  const d30str = getLocalDateString(d30)
  const last30Count = (allLogs.length > 0 ? allLogs : logs).filter(l => l.log_date >= d30str).length
  const showStreakBadge = last30Count >= 7

  // ── Form state ────────────────────────────────────────────────────────────
  const setErrors      = sets.map(s => validateSet(s, wt))
  const formValid      = setErrors.every(e => Object.keys(e).length === 0)
  const showBlockStyle = submitAttempted && !formValid

  const anyHasValues = sets.some(s => {
    if (wt === 'barbell' || wt === 'dumbbell') return s.weight || s.reps
    if (wt === 'cable') return s.big
    return s.reps || s.mins
  })
  const showGlow = formValid && anyHasValues && !saved

  function markChanged() {
    setComparisonActive(false)
    clearTimeout(comparisonTimer.current)
    comparisonTimer.current = setTimeout(() => setComparisonActive(true), 300)
  }

  // ── Progressive overload comparison ──────────────────────────────────────
  function getCompare(setIdx, field) {
    if (!comparisonActive || !lastLog?.sets?.[setIdx]) return null
    const ls = lastLog.sets[setIdx]
    let cur, last
    if (field === 'weight') {
      cur = parseFloat(sets[setIdx]?.weight); last = parseFloat(ls.weight) || 0
    } else if (field === 'cableWeight') {
      cur = cableWeight(sets[setIdx]); last = cableWeight(ls)
    } else {
      cur = parseInt(sets[setIdx]?.reps ?? ''); last = parseInt(ls.reps) || 0
    }
    if (isNaN(cur) || cur <= 0 || last <= 0) return null
    if (cur > last) return 'up'
    if (cur < last) return 'down'
    return null
  }

  function glowStyle(setIdx, field) {
    if (!comparisonActive) return {}
    const c = getCompare(setIdx, field)
    if (c === 'up')   return { boxShadow: '0 0 0 2px rgba(16,185,129,0.5)' }
    if (c === 'down') return { boxShadow: '0 0 0 2px rgba(245,158,11,0.45)' }
    return {}
  }

  // ── Input handlers ────────────────────────────────────────────────────────
  function isTouched(idx, field) { return touched.has(`${idx}-${field}`) || submitAttempted }
  function borderColor(idx, field) {
    if (!isTouched(idx, field)) return 'var(--drawer-card-border)'
    return setErrors[idx]?.[field] ? '#EF4444' : '#10B981'
  }
  function touchField(idx, field) { setTouched(prev => new Set([...prev, `${idx}-${field}`])) }
  function isDefaultZeroField(field) { return wt === 'cable' && (field === 'medium' || field === 'small') }
  function defaultZeroClass(idx, field) {
    const key = `${idx}-${field}`
    return isDefaultZeroField(field) && sets[idx]?.[field] === '0' && !focusedDefaultZeros.has(key) ? 'default-zero' : ''
  }
  function handleDefaultZeroFocus(idx, field, event) {
    if (isDefaultZeroField(field)) setFocusedDefaultZeros(prev => new Set([...prev, `${idx}-${field}`]))
    event.target.select()
  }
  function handleDefaultZeroBlur(idx, field) {
    touchField(idx, field)
    if (isDefaultZeroField(field) && sets[idx]?.[field] === '0') {
      setFocusedDefaultZeros(prev => {
        const next = new Set(prev)
        next.delete(`${idx}-${field}`)
        return next
      })
    }
  }

  function updateSet(idx, field, value) {
    setSets(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
    setSaved(false)
    markChanged()
  }
  function updateSetMulti(idx, updates) {
    setSets(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s))
    setSaved(false)
    markChanged()
  }

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
    const next = Math.max(2.5, roundTo2p5(cur + delta))
    updateSet(idx, 'weight', String(next))
    touchField(idx, 'weight')
    // Slot-machine animation via direct DOM manipulation
    const el = weightRefs.current[idx]
    if (el) {
      const cls = delta > 0 ? 'animate-slot-up' : 'animate-slot-down'
      el.classList.remove('animate-slot-up', 'animate-slot-down')
      void el.offsetWidth  // force reflow so animation restarts
      el.classList.add(cls)
    }
  }

  function handleSmallInput(idx, raw) {
    const stripped = stripInt(raw)
    const num = parseInt(stripped) || 0
    if (num > 2) {
      updateSet(idx, 'small', '2')
      setSmallNote({ setIdx: idx })
      setTimeout(() => setSmallNote(null), 2000)
    } else {
      updateSet(idx, 'small', stripped)
    }
  }

  function handleMinsInput(idx, raw) {
    const stripped = stripInt(raw)
    if ((parseInt(stripped) || 0) > 59) {
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

  function addSet() { setSets(prev => [...prev, emptySetRow(wt)]); setSaved(false) }
  function removeSet() {
    if (sets.length <= 1) return
    setSets(prev => prev.slice(0, -1)); setSaved(false)
  }

  function buildPayload() {
    return sets.map(s => {
      if (wt === 'barbell' || wt === 'dumbbell') return { weight: parseFloat(s.weight) || 0, reps: parseInt(s.reps) || 0 }
      if (wt === 'cable') return { big: parseInt(s.big) || 0, medium: parseInt(s.medium) || 0, small: parseInt(s.small) || 0, reps: parseInt(s.reps) || 0 }
      if (wt === 'reps') return { reps: parseInt(s.reps) || 0 }
      return { duration: (parseInt(s.mins) || 0) * 60 + (parseInt(s.secs) || 0) }
    })
  }

  function triggerShake() {
    setShaking(true)
    setTimeout(() => setShaking(false), 350)
  }

  function checkPR(payload) {
    const priorLogs = logs.filter(l => l.log_date !== today)
    // Fix 7A: first-ever log for this exercise is always a PR
    if (!priorLogs.length) return true
    const histMax = priorLogs.reduce((m, l) => Math.max(m, getMaxFromLog(l, wt)), 0)
    return getMaxFromSets(payload, wt) > histMax
  }

  async function handleLog() {
    setSubmitAttempted(true)
    if (!formValid) { triggerShake(); return }

    const payload = buildPayload()
    const entry = {
      exercise_id: exercise.id,
      log_date: today,
      sets: payload,
      logged_at: new Date().toISOString(),
      workout_type: workoutType || '',
    }
    // Compute the PR verdict synchronously against the payload actually being saved —
    // don't trust prBadge, which is debounced 300ms and can be stale if the user
    // edits a value and hits Log before the debounce fires.
    const isPR = checkPR(payload)
    setPrBadge(isPR)

    setSaving(true)
    const { data: savedEntry, error } = await supabase
      .from('exercise_logs')
      .upsert(entry, { onConflict: 'exercise_id,log_date,workout_type' })
      .select()
      .single()
    setSaving(false)
    if (error) return

    setSaved(true)
    onLogSave(savedEntry || { ...entry, id: todayLog?.id ?? `opt-${Date.now()}` })

    spawnParticles(logBtnRef.current, isPR)
    if (isPR) {
      setPrFlash(true)
      setTimeout(() => setPrFlash(false), 1600)
    }
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
      style={{
        background: expanded ? 'var(--drawer-card-bg-exp)' : 'var(--drawer-card-bg)',
        border: `1px solid ${prFlash ? 'rgba(245,158,11,0.55)' : 'var(--drawer-card-border)'}`,
        boxShadow: prFlash ? '0 0 18px rgba(245,158,11,0.18)' : undefined,
        transition: 'border-color 300ms ease, box-shadow 300ms ease, background 200ms ease',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-medium text-sm text-os-fg truncate">{exercise.name}</span>
            {saved && <i className="ti ti-circle-check text-emerald-500 text-sm flex-shrink-0" />}
            {prBadge && (
              <span
                className="animate-slide-in-right flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold"
                style={{ background: 'rgba(245,158,11,0.14)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}
              >
                🏆 PR!
              </span>
            )}
            {showStreakBadge && (
              <span
                className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono"
                style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.22)' }}
              >
                🔥 {last30Count}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={['text-xs font-body', daysStyle.pulse ? 'animate-heartbeat' : ''].join(' ')}
              style={{ color: daysStyle.color }}
            >
              {daysStyle.label}
            </span>
            <span className="text-xs text-os-muted opacity-40">·</span>
            <span className="text-xs font-body text-os-muted capitalize">{wt}</span>
          </div>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
          {availableTags.length > 0 && (
            <button ref={tagBtnRef} onClick={openTagPicker} className="p-2 rounded-md text-os-muted hover:text-os-indigo transition-colors" title="Also show in another workout type">
              <i className="ti ti-tag-plus text-sm" />
            </button>
          )}
          <i className={['ti text-sm text-os-muted transition-transform duration-200 mr-0.5', expanded ? 'ti-chevron-up' : 'ti-chevron-down'].join(' ')} />
        </div>
      </div>

      {/* Action row */}
      <div className="flex flex-wrap gap-2 px-4 pb-3">
        <button onClick={() => onOpenGraph()} className="action-pill-btn action-pill-emerald">
          <i className="ti ti-chart-line" />
          View graph
        </button>
        {todayLog && (
          <button onClick={() => onDeleteToday()} className="action-pill-btn action-pill-red">
            <i className="ti ti-trash" />
            Delete selected date
          </button>
        )}
        {(exercise.workout_type_tags || []).length > 1 && (
          <button onClick={() => onRemoveExercise()} className="action-pill-btn action-pill-red">
            <i className="ti ti-tag-off" />
            Remove from {workoutType}
          </button>
        )}
      </div>

      {/* Expanded form */}
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
              <span className="w-6 flex-shrink-0" />
              <span className="text-[10px] font-body text-os-muted w-16 text-center">Big</span>
              <span className="text-[10px] font-body text-os-muted w-16 text-center">Medium</span>
              <span className="text-[10px] font-body text-os-muted w-14 text-center">Small</span>
              <span className="w-4 flex-shrink-0" />
              <span className="text-[10px] font-body text-os-muted w-16 text-center">Reps</span>
            </div>
          )}

          <div className={['space-y-2', wt !== 'cable' ? 'mt-3' : ''].join(' ')}>
            {sets.map((set, i) => {
              const complete = isSetComplete(set, wt)
              const errs = setErrors[i]
              const firstErr = Object.entries(errs).find(([f]) => isTouched(i, f) && errs[f])
              const showingWeightNote = weightNotes.has(i)
              return (
                <div key={i}>
                  <div className="flex items-center gap-2">
                    {/* Set completion indicator */}
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{
                        background: complete ? '#10B981' : 'transparent',
                        border: `2px solid ${complete ? '#10B981' : 'rgba(144,144,176,0.3)'}`,
                        transition: 'all 200ms ease',
                        flexShrink: 0,
                      }}
                    >
                      {complete && (
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    <span className="text-xs font-mono text-os-muted w-6 flex-shrink-0 select-none">S{i + 1}</span>

                    {(wt === 'barbell' || wt === 'dumbbell') && (
                      <>
                        <div className="flex items-center gap-0.5">
                          <input
                            ref={el => weightRefs.current[i] = el}
                            type="text" inputMode="decimal" placeholder="kg"
                            value={set.weight}
                            onChange={e => handleWeightInput(i, e.target.value)}
                            onBlur={() => handleWeightBlur(i)}
                            onFocus={e => e.target.select()}
                            className={`drawer-input w-16 font-mono ${shaking && errs.weight ? 'animate-shake' : ''}`}
                            style={{ borderColor: borderColor(i, 'weight'), ...glowStyle(i, 'weight') }}
                          />
                          <div className="flex flex-col ml-0.5">
                            <button type="button" onClick={e => { e.stopPropagation(); adjustWeight(i, 2.5) }} className="text-[9px] text-os-muted hover:text-os-fg leading-none px-0.5 py-px select-none">▲</button>
                            <button type="button" onClick={e => { e.stopPropagation(); adjustWeight(i, -2.5) }} className="text-[9px] text-os-muted hover:text-os-fg leading-none px-0.5 py-px select-none">▼</button>
                          </div>
                          {comparisonActive && getCompare(i, 'weight') && (
                            <span style={{ color: getCompare(i, 'weight') === 'up' ? '#10B981' : '#F59E0B', fontSize: 11, marginLeft: 2, fontWeight: 700 }}>
                              {getCompare(i, 'weight') === 'up' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-os-muted select-none">×</span>
                        <input
                          type="text" inputMode="numeric" placeholder="reps"
                          value={set.reps}
                          onChange={e => handleIntInput(i, 'reps', e.target.value)}
                          onBlur={() => touchField(i, 'reps')}
                          onFocus={e => e.target.select()}
                          className={`drawer-input w-16 ${shaking && errs.reps ? 'animate-shake' : ''}`}
                          style={{ borderColor: borderColor(i, 'reps'), ...glowStyle(i, 'reps') }}
                        />
                        {comparisonActive && getCompare(i, 'reps') && (
                          <span style={{ color: getCompare(i, 'reps') === 'up' ? '#10B981' : '#F59E0B', fontSize: 11, fontWeight: 700 }}>
                            {getCompare(i, 'reps') === 'up' ? '↑' : '↓'}
                          </span>
                        )}
                      </>
                    )}

                    {wt === 'cable' && (
                      <>
                        <input type="text" inputMode="numeric" placeholder="1" value={set.big}
                          onChange={e => handleIntInput(i, 'big', e.target.value)} onBlur={() => touchField(i, 'big')}
                          onFocus={e => e.target.select()}
                          className={`drawer-input w-16 ${shaking && errs.big ? 'animate-shake' : ''}`}
                          style={{ borderColor: borderColor(i, 'big'), ...glowStyle(i, 'cableWeight') }} />
                        <input type="text" inputMode="numeric" placeholder="0" value={set.medium}
                          onChange={e => handleIntInput(i, 'medium', e.target.value)} onBlur={() => handleDefaultZeroBlur(i, 'medium')}
                          onFocus={e => handleDefaultZeroFocus(i, 'medium', e)}
                          className={`drawer-input w-16 ${defaultZeroClass(i, 'medium')} ${shaking && errs.medium ? 'animate-shake' : ''}`}
                          style={{ borderColor: borderColor(i, 'medium'), ...glowStyle(i, 'cableWeight') }} />
                        <input type="text" inputMode="numeric" placeholder="0" value={set.small}
                          onChange={e => handleSmallInput(i, e.target.value)} onBlur={() => handleDefaultZeroBlur(i, 'small')}
                          onFocus={e => handleDefaultZeroFocus(i, 'small', e)}
                          className={`drawer-input w-14 ${defaultZeroClass(i, 'small')} ${shaking && errs.small ? 'animate-shake' : ''}`}
                          style={{ borderColor: borderColor(i, 'small'), ...glowStyle(i, 'cableWeight') }} />
                        {comparisonActive && getCompare(i, 'cableWeight') && (
                          <span style={{ color: getCompare(i, 'cableWeight') === 'up' ? '#10B981' : '#F59E0B', fontSize: 11, fontWeight: 700 }}>
                            {getCompare(i, 'cableWeight') === 'up' ? '↑' : '↓'}
                          </span>
                        )}
                        <span className="text-xs text-os-muted select-none">×</span>
                        <input type="text" inputMode="numeric" placeholder="reps" value={set.reps}
                          onChange={e => handleIntInput(i, 'reps', e.target.value)} onBlur={() => touchField(i, 'reps')}
                          onFocus={e => e.target.select()}
                          className={`drawer-input w-16 ${shaking && errs.reps ? 'animate-shake' : ''}`}
                          style={{ borderColor: borderColor(i, 'reps') }} />
                      </>
                    )}

                    {wt === 'reps' && (
                      <>
                        <input type="text" inputMode="numeric" placeholder="reps" value={set.reps}
                          onChange={e => handleIntInput(i, 'reps', e.target.value)} onBlur={() => touchField(i, 'reps')}
                          onFocus={e => e.target.select()}
                          className={`drawer-input w-28 ${shaking && errs.reps ? 'animate-shake' : ''}`}
                          style={{ borderColor: borderColor(i, 'reps'), ...glowStyle(i, 'reps') }} />
                        {comparisonActive && getCompare(i, 'reps') && (
                          <span style={{ color: getCompare(i, 'reps') === 'up' ? '#10B981' : '#F59E0B', fontSize: 11, fontWeight: 700 }}>
                            {getCompare(i, 'reps') === 'up' ? '↑' : '↓'}
                          </span>
                        )}
                      </>
                    )}

                    {wt === 'time' && (
                      <>
                        <input type="text" inputMode="numeric" placeholder="mm" value={set.mins}
                          onChange={e => handleMinsInput(i, e.target.value)} onBlur={() => touchField(i, 'mins')}
                          onFocus={e => e.target.select()}
                          className={`drawer-input w-16 ${shaking && errs.mins ? 'animate-shake' : ''}`}
                          style={{ borderColor: borderColor(i, 'mins') }} />
                        <span className="text-xs text-os-muted select-none">:</span>
                        <input type="text" inputMode="numeric" placeholder="ss" value={set.secs}
                          onChange={e => handleSecsInput(i, e.target.value)}
                          onFocus={e => e.target.select()}
                          className="drawer-input w-16" />
                      </>
                    )}
                  </div>

                  {showingWeightNote && (
                    <p className="text-[11px] font-body text-amber-500 ml-12 mt-0.5">Rounded to nearest 2.5 kg</p>
                  )}
                  {smallNote?.setIdx === i && (
                    <p className="text-[11px] font-body text-amber-500 ml-12 mt-0.5">Max 2 small plates</p>
                  )}
                  {firstErr && !showingWeightNote && (
                    <p className="text-[11px] font-body text-red-500 ml-12 mt-0.5">{firstErr[1]}</p>
                  )}
                </div>
              )
            })}
          </div>

          {timeCapNote && <p className="text-[11px] font-body text-amber-500 mt-1 ml-12">Maximum duration is 60 minutes</p>}

          <div className="flex gap-4 mt-3">
            <button onClick={removeSet} disabled={sets.length <= 1}
              className="text-xs font-body text-os-muted hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              − Remove set
            </button>
            <button onClick={addSet} className="text-xs font-body text-os-muted hover:text-os-fg transition-colors">
              + Add set
            </button>
          </div>

          <button
            ref={logBtnRef}
            onClick={handleLog}
            disabled={saving || viewOnly}
            className={`mt-4 w-full py-2 rounded-lg text-sm font-body font-semibold transition-all disabled:opacity-60 ${shaking ? 'animate-shake' : showGlow ? 'animate-breathe-glow' : ''}`}
            style={viewOnly ? {
              background: 'rgba(144,144,176,0.08)',
              border: '1px solid rgba(144,144,176,0.2)',
              color: 'var(--os-muted)',
              cursor: 'not-allowed',
            } : saved ? {
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
            {saving ? 'Saving...' : viewOnly ? 'Logged in another category on selected date' : saved ? 'Logged' : showBlockStyle ? 'Fix errors above' : 'Log workout'}
          </button>
        </div>
      )}

      {showTagPicker && tagDropdownPos && createPortal(
        <div
          ref={tagDropdownRef}
          className="rounded-lg shadow-lg p-1"
          style={{ position: 'fixed', top: tagDropdownPos.top, right: tagDropdownPos.right, zIndex: 500, minWidth: 130, background: 'var(--drawer-bg)', border: '1px solid var(--drawer-card-border)' }}
          onClick={e => e.stopPropagation()}
        >
          <p className="text-[10px] font-body text-os-muted px-2 py-1 uppercase tracking-wide">Also show in</p>
          {availableTags.map(type => (
            <button key={type} onClick={e => { e.stopPropagation(); onAddTag(exercise.id, type); setShowTagPicker(false) }}
              className="w-full text-left text-xs font-body px-2 py-1.5 rounded hover:text-os-fg text-os-secondary transition-colors">
              {type}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
