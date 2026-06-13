/*
 * QA fixes applied:
 * - Multi-series: Max weight + per-set lines; Compare sets toggle
 * - Cable type uses plates + mini*0.5 proxy; tooltip shows raw values
 * - Gap segments rendered as dashed lines between real data points
 * - Empty state threshold lowered to 1 session (shows dot + note)
 * - Y domain computed across all active series in compare mode
 */
import { useState } from 'react'

const W = 480, H = 220
const PAD = { top: 24, right: 24, bottom: 36, left: 48 }
const CW = W - PAD.left - PAD.right
const CH = H - PAD.top - PAD.bottom

const SERIES_COLORS = {
  max:  '#6366F1',
  set0: '#10B981',
  set1: '#F59E0B',
  set2: '#8B5CF6',
  set3: '#EF4444',
  set4: '#06B6D4',
}
function seriesColor(key) { return SERIES_COLORS[key] || '#6366F1' }

function cableValue(set) {
  if (set == null) return null
  if (set.plates !== undefined) return (set.plates || 0) + (set.mini || 0) * 0.5
  return set.weight || 0  // backward compat with old {weight} format
}

function getSingleSetValue(set, wt) {
  if (set == null) return null
  if (wt === 'cable')                          return cableValue(set)
  if (wt === 'barbell' || wt === 'dumbbell')  return set.weight || null
  if (wt === 'reps')                           return set.reps   || null
  if (wt === 'time')                           return set.duration || null
  return null
}

function getSeriesValue(sets, key, wt) {
  if (!sets?.length) return null
  if (key === 'max') {
    const vals = sets.map(s => getSingleSetValue(s, wt)).filter(v => v !== null)
    return vals.length ? Math.max(...vals) : null
  }
  const idx = parseInt(key.replace('set', ''))
  return idx < sets.length ? getSingleSetValue(sets[idx], wt) : null
}

function getYLabel(wt) {
  if (wt === 'barbell' || wt === 'dumbbell') return 'Weight (kg)'
  if (wt === 'cable')  return 'Resistance (plates + mini×0.5)'
  if (wt === 'reps')   return 'Reps'
  return 'Duration (seconds)'
}

function formatTooltipValue(value, key, session, wt) {
  if (wt === 'cable') {
    if (key === 'max') {
      const best = (session.sets || []).reduce((b, s) => {
        const v = cableValue(s); return (v != null && (b == null || v > cableValue(b))) ? s : b
      }, null)
      if (best?.plates !== undefined) return `P${best.plates} M${best.mini} (≈${value})`
    } else {
      const idx = parseInt(key.replace('set', ''))
      const s = session.sets?.[idx]
      if (s?.plates !== undefined) return `P${s.plates} M${s.mini} (≈${value})`
    }
    return String(value)
  }
  if (wt === 'time') {
    const m = Math.floor(value / 60), s = value % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }
  return String(value)
}

// Build solid path segments and dashed gap connectors for one series
function buildSeriesPaths(n, values, pxFn, pyFn) {
  const solidParts = [], dashedParts = []
  let currentPath = null, lastRealI = null

  for (let i = 0; i < n; i++) {
    if (values[i] == null) { continue }
    const cx = pxFn(i).toFixed(1), cy = pyFn(values[i]).toFixed(1)
    if (lastRealI === null) {
      currentPath = `M${cx},${cy}`
    } else if (i === lastRealI + 1) {
      currentPath += ` L${cx},${cy}`
    } else {
      if (currentPath) solidParts.push(currentPath)
      dashedParts.push(`M${pxFn(lastRealI).toFixed(1)},${pyFn(values[lastRealI]).toFixed(1)} L${cx},${cy}`)
      currentPath = `M${cx},${cy}`
    }
    lastRealI = i
  }
  if (currentPath) solidParts.push(currentPath)
  return { solid: solidParts.join(' '), dashed: dashedParts.join(' ') }
}

export default function ProgressGraph({ exercise, logs, onClose }) {
  const wt = exercise.weight_type

  // Chronological order
  const sessions = [...logs].reverse()
  const n = sessions.length

  const maxSets = Math.max(0, ...sessions.map(s => s.sets?.length || 0))
  const seriesOptions = [
    { key: 'max', label: 'Max' },
    ...Array.from({ length: maxSets }, (_, i) => ({ key: `set${i}`, label: `Set ${i + 1}` })),
  ]

  const [seriesKey, setSeriesKey]     = useState('max')
  const [compareMode, setCompareMode] = useState(false)
  const [hovered, setHovered]         = useState(null)  // { seriesKey, sessionIdx }

  // Compare mode shows only individual sets, not the Max aggregate line
  const activeSeries = compareMode ? seriesOptions.filter(s => s.key !== 'max').map(s => s.key) : [seriesKey]

  // Build values per active series
  const seriesValues = {}
  for (const key of activeSeries) {
    seriesValues[key] = sessions.map(s => getSeriesValue(s.sets, key, wt))
  }

  // Y domain across all active series
  const allVals = activeSeries.flatMap(k => seriesValues[k]).filter(v => v != null)
  const minY = allVals.length ? Math.min(...allVals) : 0
  const maxY = allVals.length ? Math.max(...allVals) : 1
  const range = maxY === minY ? 1 : maxY - minY
  const pad   = range * 0.12
  const dMin  = minY - pad
  const dMax  = maxY + pad
  const dRange = dMax - dMin

  const px = i => PAD.left + (n <= 1 ? CW / 2 : (i / (n - 1)) * CW)
  const py = v => PAD.top + CH - ((v - dMin) / dRange) * CH

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(t => dMin + t * dRange)

  const xIdxs = n <= 5
    ? sessions.map((_, i) => i)
    : Array.from(new Set([0, Math.round(n / 4), Math.round(n / 2), Math.round(3 * n / 4), n - 1]))

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ zIndex: 200 }} onClick={onClose} />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 w-full max-w-lg mx-4"
        style={{ zIndex: 201, background: 'var(--drawer-bg)', border: '1px solid var(--drawer-card-border)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Title row */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display font-semibold text-sm text-os-fg">{exercise.name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md text-os-muted hover:text-os-fg transition-colors">
            <i className="ti ti-x text-base" />
          </button>
        </div>
        <p className="text-xs font-body text-os-muted mb-4">{getYLabel(wt)}</p>

        {/* Controls */}
        {n > 0 && (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {/* Series selector pills */}
            <div className="flex items-center gap-1 flex-wrap">
              {seriesOptions.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => { if (!compareMode) setSeriesKey(opt.key) }}
                  disabled={compareMode}
                  className="px-2.5 py-1 rounded-full text-xs font-body transition-all"
                  style={(!compareMode && seriesKey === opt.key) ? {
                    background: `${seriesColor(opt.key)}22`,
                    border: `1px solid ${seriesColor(opt.key)}66`,
                    color: seriesColor(opt.key),
                  } : {
                    background: 'transparent',
                    border: '1px solid var(--drawer-card-border)',
                    color: compareMode ? 'var(--os-muted)' : 'var(--os-secondary)',
                    opacity: compareMode ? 0.5 : 1,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Compare toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer ml-auto flex-shrink-0">
              <span className="text-xs font-body text-os-secondary">Compare sets</span>
              <button
                onClick={() => {
                  if (!compareMode && seriesKey === 'max') setSeriesKey('set0')
                  setCompareMode(v => !v)
                }}
                className={['rounded-full transition-colors relative flex-shrink-0', compareMode ? 'bg-os-indigo' : 'bg-os-muted opacity-40'].join(' ')}
                style={{ width: 44, height: 24, minWidth: 44 }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: compareMode ? 'translateX(20px)' : 'translateX(2px)' }}
                />
              </button>
            </label>
          </div>
        )}

        {/* Graph or empty state */}
        {n === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm font-body text-os-muted text-center px-4">
            Log at least 1 session to see your progress graph
          </div>
        ) : (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200, overflow: 'visible' }}>
              {/* Grid lines + Y labels */}
              {gridVals.map((val, ti) => {
                const y = py(val)
                return (
                  <g key={ti}>
                    <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" className="text-zinc-700 dark:text-white" />
                    <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.4" className="font-mono">
                      {Math.round(val)}
                    </text>
                  </g>
                )
              })}

              {/* Area fill — single series only, all real points bridged */}
              {!compareMode && (() => {
                const vals = seriesValues[seriesKey]
                const real = sessions.map((_, i) => vals[i] != null ? i : null).filter(i => i != null)
                if (real.length < 2) return null
                const aD = real.map((i, k) => `${k === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(vals[i]).toFixed(1)}`).join(' ')
                  + ` L${px(real[real.length - 1]).toFixed(1)},${(PAD.top + CH).toFixed(1)}`
                  + ` L${px(real[0]).toFixed(1)},${(PAD.top + CH).toFixed(1)} Z`
                return <path d={aD} fill={`${seriesColor(seriesKey)}14`} />
              })()}

              {/* Series lines + dots */}
              {activeSeries.map(key => {
                const vals = seriesValues[key]
                const { solid, dashed } = buildSeriesPaths(n, vals, px, py)
                const color = seriesColor(key)
                return (
                  <g key={key}>
                    {solid  && <path d={solid}  fill="none" stroke={color} strokeWidth="2"   strokeLinejoin="round" strokeLinecap="round" />}
                    {dashed && <path d={dashed} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="4 4" strokeLinejoin="round" strokeLinecap="round" />}

                    {sessions.map((session, i) => {
                      const val = vals[i]
                      if (val == null) return null
                      const cx = px(i), cy = py(val)
                      const isHov = hovered?.seriesKey === key && hovered?.sessionIdx === i
                      const tipX = Math.min(Math.max(cx, PAD.left + 60), W - PAD.right - 60)
                      const tipY = cy - 36

                      return (
                        <g key={i}>
                          <circle cx={cx} cy={cy} r={isHov ? 5 : 3.5} fill={color} />
                          {isHov && <circle cx={cx} cy={cy} r="9" fill={color} fillOpacity="0.18" />}
                          {isHov && (
                            <g>
                              <rect x={tipX - 60} y={tipY} width="120" height="22" rx="4" fill="#0F0F1A" stroke="#1C1C2E" />
                              <text x={tipX} y={tipY + 14} textAnchor="middle" fontSize="10" fill="#E8E8F0" className="font-mono">
                                {session.log_date.slice(5)} · {formatTooltipValue(val, key, session, wt)}
                              </text>
                            </g>
                          )}
                          <circle
                            cx={cx} cy={cy} r="14" fill="transparent"
                            style={{ cursor: 'crosshair' }}
                            onMouseEnter={() => setHovered({ seriesKey: key, sessionIdx: i })}
                            onMouseLeave={() => setHovered(null)}
                          />
                        </g>
                      )
                    })}
                  </g>
                )
              })}

              {/* X-axis labels */}
              {xIdxs.map(i => (
                <text key={i} x={px(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.4" className="font-mono">
                  {sessions[i].log_date.slice(5)}
                </text>
              ))}
            </svg>

            {/* Notes for series with < 2 data points */}
            {activeSeries.map(key => {
              const count = seriesValues[key].filter(v => v != null).length
              if (count >= 2) return null
              const label = seriesOptions.find(o => o.key === key)?.label || key
              return (
                <p key={key} className="text-[11px] font-body text-os-muted mt-2">
                  {count === 0 ? `No data for ${label} yet` : `Add more sessions to see ${label}'s trend`}
                </p>
              )
            })}

            {/* Compare mode legend */}
            {compareMode && (
              <div className="flex flex-wrap gap-3 mt-3">
                {activeSeries.map(key => {
                  const label = seriesOptions.find(o => o.key === key)?.label || key
                  return (
                    <div key={key} className="flex items-center gap-1">
                      <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: seriesColor(key) }} />
                      <span className="text-[11px] font-body text-os-secondary">{label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
