import { useState } from 'react'

const W = 480, H = 220
const PAD = { top: 24, right: 24, bottom: 36, left: 52 }
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
  if (set.plates !== undefined) return (set.plates || 0) * 7 + (set.mini || 0) * 2.3
  return set.weight || 0
}

function getSeriesValue(sets, key, wt) {
  if (!sets?.length) return null
  if (key === 'max') {
    const vals = sets.map(s => {
      if (wt === 'cable') return cableValue(s)
      if (wt === 'barbell' || wt === 'dumbbell') return s.weight || null
      if (wt === 'reps') return s.reps || null
      if (wt === 'time') return s.duration || null
      return null
    }).filter(v => v !== null)
    return vals.length ? Math.max(...vals) : null
  }
  const idx = parseInt(key.replace('set', ''))
  if (idx >= sets.length) return null
  const s = sets[idx]
  if (wt === 'cable') return cableValue(s)
  if (wt === 'barbell' || wt === 'dumbbell') return s.weight || null
  if (wt === 'reps') return s.reps || null
  if (wt === 'time') return s.duration || null
  return null
}

function getRepsSeriesValue(sets, key) {
  if (!sets?.length) return null
  if (key === 'max') {
    const vals = sets.map(s => s.reps).filter(v => v != null && v > 0)
    return vals.length ? Math.max(...vals) : null
  }
  const idx = parseInt(key.replace('set', ''))
  return idx < sets.length ? (sets[idx]?.reps || null) : null
}

function getYLabel(wt, viewMode) {
  if (viewMode === 'reps') return 'Reps'
  if (wt === 'barbell' || wt === 'dumbbell') return 'Weight (kg)'
  if (wt === 'cable') return 'Resistance (kg)'
  return 'Duration (seconds)'
}

// Always starts y-axis from 0; adds 15% headroom above max
function computeTicks(allVals, use2p5) {
  const rawMax = allVals.length > 0 ? Math.max(...allVals) : 10

  if (use2p5) {
    const yMax = Math.max(2.5, Math.ceil(rawMax * 1.15 / 2.5) * 2.5)

    function genTicks(min, max, step) {
      const ticks = []
      let v = min
      while (v <= max + 0.001) { ticks.push(Math.round(v * 1000) / 1000); v += step }
      return ticks
    }

    let ticks = genTicks(0, yMax, 2.5)
    if (ticks.length > 8) ticks = genTicks(0, yMax, 5)
    if (ticks.length > 8) ticks = genTicks(0, yMax, 10)
    return { ticks, yMin: 0, yMax }
  } else {
    const yMax = Math.max(1, Math.ceil(rawMax * 1.15))

    function genTicks(min, max, step) {
      const ticks = []
      for (let v = min; v <= max + 0.001; v += step) ticks.push(Math.round(v))
      return ticks
    }

    let ticks = genTicks(0, yMax, 1)
    if (ticks.length > 8) ticks = genTicks(0, yMax, 2)
    if (ticks.length > 8) ticks = genTicks(0, yMax, 5)
    if (ticks.length > 8) ticks = genTicks(0, yMax, 10)
    return { ticks, yMin: 0, yMax }
  }
}

// Fix 5: tick formatter
function fmtTick(val) {
  return Number.isInteger(val) ? String(val) : val.toFixed(1)
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

// Fix 6: combined tooltip entry with richer format
function formatCombinedEntry(key, val, session, wt, viewMode) {
  const sets = session.sets || []
  if (viewMode === 'reps') return `${val} reps`

  if (wt === 'barbell' || wt === 'dumbbell') {
    if (key === 'max') {
      const best = sets.reduce((b, s) => !b || (s.weight || 0) > (b.weight || 0) ? s : b, null)
      return best ? `${best.weight}kg × ${best.reps} reps` : `${val}kg`
    }
    const idx = parseInt(key.replace('set', ''))
    const s = sets[idx]
    return s ? `${s.weight}kg × ${s.reps} reps` : `${val}kg`
  }

  if (wt === 'cable') {
    if (key === 'max') {
      const best = sets.reduce((b, s) => {
        const v = cableValue(s); return (v != null && (b == null || v > cableValue(b))) ? s : b
      }, null)
      return best?.plates !== undefined ? `P${best.plates} M${best.mini} × ${best.reps}` : `${val}`
    }
    const idx = parseInt(key.replace('set', ''))
    const s = sets[idx]
    return s?.plates !== undefined ? `P${s.plates} M${s.mini} × ${s.reps}` : `${val}`
  }

  if (wt === 'time') {
    const m = Math.floor(val / 60), s = val % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  return `${val} reps`
}

// Build solid path segments and dashed gap connectors for one series
function buildSeriesPaths(n, values, pxFn, pyFn) {
  const solidParts = [], dashedParts = []
  let currentPath = null, lastRealI = null

  for (let i = 0; i < n; i++) {
    if (values[i] == null) continue
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

  // Fix 4: view mode — reps type forces reps, time type forces weight, others can toggle
  const canToggleView = wt !== 'reps' && wt !== 'time'
  const [viewMode, setViewMode] = useState(wt === 'reps' ? 'reps' : 'weight')

  const sessions = [...logs].reverse()
  const n = sessions.length

  const maxSets = Math.max(0, ...sessions.map(s => s.sets?.length || 0))

  // Per-series PR computation: prStyle[seriesKey][sessionIdx] = 'latest' | 'earlier'
  // 'max' key: PR = new high across all sets that session
  // 'set0', 'set1', ...: each position tracks its own running max independently
  const prStyle = (() => {
    const result = {}
    if (wt !== 'barbell' && wt !== 'dumbbell' && wt !== 'cable' && wt !== 'reps') return result

    function buildPRMap(getVal) {
      let runMax = -Infinity
      const prSet = new Set()
      for (let i = 0; i < n; i++) {
        const val = getVal(i)
        if (val == null || val <= 0) continue
        if (val > runMax) { runMax = val; prSet.add(i) }
      }
      if (prSet.size === 0) return {}
      const latest = Math.max(...prSet)
      const map = {}
      prSet.forEach(i => { map[i] = i === latest ? 'latest' : 'earlier' })
      return map
    }

    result['max'] = buildPRMap(i => {
      const sets = sessions[i]?.sets
      if (!sets?.length) return null
      const vals = sets.map(s => {
        if (wt === 'barbell' || wt === 'dumbbell') return s.weight || 0
        if (wt === 'cable') return (s.plates || 0) * 7 + (s.mini || 0) * 2.3
        return s.reps || 0
      })
      return Math.max(...vals)
    })

    for (let pos = 0; pos < maxSets; pos++) {
      result[`set${pos}`] = buildPRMap(i => {
        const sets = sessions[i]?.sets
        if (!sets || pos >= sets.length) return null
        const s = sets[pos]
        if (wt === 'barbell' || wt === 'dumbbell') return s.weight || 0
        if (wt === 'cable') return (s.plates || 0) * 7 + (s.mini || 0) * 2.3
        return s.reps || 0
      })
    }

    return result
  })()
  const seriesOptions = [
    { key: 'max', label: viewMode === 'reps' ? 'Max reps' : 'Max' },
    ...Array.from({ length: maxSets }, (_, i) => ({ key: `set${i}`, label: `Set ${i + 1}` })),
  ]

  const [seriesKey, setSeriesKey]     = useState('max')
  const [compareMode, setCompareMode] = useState(false)
  const [hovered, setHovered]         = useState(null)  // { seriesKey, sessionIdx }

  function switchViewMode(mode) {
    setViewMode(mode)
    setSeriesKey('max')
    setCompareMode(false)
  }

  const activeSeries = compareMode
    ? seriesOptions.filter(s => s.key !== 'max').map(s => s.key)
    : [seriesKey]

  const seriesValues = {}
  for (const key of activeSeries) {
    seriesValues[key] = sessions.map(s => {
      if (viewMode === 'reps') return getRepsSeriesValue(s.sets, key)
      return getSeriesValue(s.sets, key, wt)
    })
  }

  // Fix 5: compute domain + ticks
  const allVals = activeSeries.flatMap(k => seriesValues[k]).filter(v => v != null)
  const use2p5 = viewMode === 'weight' && (wt === 'barbell' || wt === 'dumbbell' || wt === 'cable')
  const { ticks: gridVals, yMin, yMax } = computeTicks(allVals, use2p5)
  const dMin = yMin, dMax = yMax, dRange = dMax - dMin || 1

  const px = i => PAD.left + (n <= 1 ? CW / 2 : (i / (n - 1)) * CW)
  const py = v => PAD.top + CH - ((v - dMin) / dRange) * CH

  const xIdxs = n <= 5
    ? sessions.map((_, i) => i)
    : Array.from(new Set([0, Math.round(n / 4), Math.round(n / 2), Math.round(3 * n / 4), n - 1]))

  // Fix 6: precompute dot pixel offsets for compare mode overlaps
  const dotOffsets = {}
  if (compareMode) {
    const OFFSET_PATTERNS = { 1: [0], 2: [-4, 4], 3: [-4, 0, 4], 4: [-6, -2, 2, 6] }
    for (let i = 0; i < n; i++) {
      const present = activeSeries.filter(k => seriesValues[k][i] != null)
      if (present.length <= 1) {
        dotOffsets[i] = {}
        for (const k of present) dotOffsets[i][k] = 0
        continue
      }
      // Group by Y value within 1-unit tolerance
      const groups = []
      for (const k of present) {
        const y = seriesValues[k][i]
        const g = groups.find(g => Math.abs(g.refY - y) <= 1)
        if (g) g.keys.push(k)
        else groups.push({ refY: y, keys: [k] })
      }
      dotOffsets[i] = {}
      for (const g of groups) {
        const count = Math.min(g.keys.length, 4)
        const offs = OFFSET_PATTERNS[count] || OFFSET_PATTERNS[4]
        g.keys.forEach((k, ki) => { dotOffsets[i][k] = offs[Math.min(ki, offs.length - 1)] })
      }
    }
  }

  function getDotOffset(key, i) {
    if (!compareMode) return 0
    return dotOffsets[i]?.[key] || 0
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ zIndex: 200 }} onClick={onClose} />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 w-[90vw] max-w-[900px]"
        style={{ zIndex: 201, background: 'var(--drawer-bg)', border: '1px solid var(--drawer-card-border)', height: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Title row */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display font-semibold text-sm text-os-fg">{exercise.name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md text-os-muted hover:text-os-fg transition-colors">
            <i className="ti ti-x text-base" />
          </button>
        </div>
        <p className="text-xs font-body text-os-muted mb-4">{getYLabel(wt, viewMode)}</p>

        {n > 0 && (
          <>
            {/* Fix 4: View mode toggle (only for weight-type exercises) */}
            {canToggleView && (
              <div className="flex items-center gap-1 mb-3">
                <span className="text-xs font-body text-os-secondary mr-1">View</span>
                {[{ key: 'weight', label: 'Weight' }, { key: 'reps', label: 'Reps' }].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => switchViewMode(opt.key)}
                    className="px-3 py-1 text-xs font-body rounded-full transition-all"
                    style={viewMode === opt.key ? {
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
            )}

            {/* Series selector pills */}
            <div className="flex items-center gap-1 flex-wrap mb-3">
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

            {/* Compare sets toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12, overflow: 'visible', marginBottom: 16 }}>
              <span className="text-xs font-body text-os-secondary">Compare sets</span>
              <div
                onClick={() => {
                  if (!compareMode && seriesKey === 'max') setSeriesKey('set0')
                  setCompareMode(v => !v)
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  width: 44, height: 24, borderRadius: 12,
                  backgroundColor: compareMode ? '#6366F1' : '#3F3F5A',
                  cursor: 'pointer', position: 'relative', flexShrink: 0,
                  transition: 'background-color 200ms ease',
                }}
              >
                <div style={{
                  position: 'absolute', top: 2,
                  left: compareMode ? 22 : 2,
                  width: 20, height: 20, borderRadius: 10,
                  backgroundColor: 'white',
                  transition: 'left 200ms ease',
                  pointerEvents: 'none',
                }} />
              </div>
            </div>
          </>
        )}

        {n === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm font-body text-os-muted text-center px-4">
            Log at least 1 session to see your progress graph
          </div>
        ) : (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'max(220px, 55vh)', overflow: 'visible' }}>
              {/* Fix 5: grid lines + Y labels with proper ticks */}
              {gridVals.map((val, ti) => {
                const y = py(val)
                return (
                  <g key={ti}>
                    <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                      stroke="currentColor" strokeOpacity="0.07" strokeWidth="1"
                      className="text-zinc-700 dark:text-white" />
                    <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="9"
                      fill="currentColor" fillOpacity="0.4" className="font-mono">
                      {fmtTick(val)}
                    </text>
                  </g>
                )
              })}

              {/* Area fill — single series only */}
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
                      const cx = px(i)
                      const yOffset = getDotOffset(key, i)
                      const cy = py(val) + yOffset
                      const isHov = compareMode
                        ? hovered?.sessionIdx === i
                        : hovered?.seriesKey === key && hovered?.sessionIdx === i
                      // PR dots per series — each set position tracks its own PR history independently
                      const dotStyle = prStyle[key]?.[i] || 'normal'
                      const isLatestPR = dotStyle === 'latest'
                      const isEarlierPR = dotStyle === 'earlier'
                      const isPR = isLatestPR || isEarlierPR

                      return (
                        <g key={i}>
                          {/* Pulsing ring — pointerEvents="none" so it doesn't block the hit target */}
                          {isLatestPR && (
                            <circle cx={cx} cy={cy} fill="none" stroke="#FFD700" strokeWidth="1.5" pointerEvents="none">
                              <animate attributeName="r" from="5" to="11" dur="1.5s" repeatCount="indefinite" />
                              <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite" />
                            </circle>
                          )}
                          {isLatestPR ? (
                            <circle
                              cx={cx} cy={cy} r={isHov ? 6 : 5}
                              fill="#FFD700"
                              stroke="#FFF8DC" strokeWidth="2" strokeOpacity="0.6"
                              pointerEvents="none"
                              style={{ filter: 'drop-shadow(0 0 4px rgba(255,215,0,0.8))' }}
                            />
                          ) : isEarlierPR ? (
                            <polygon
                              points={`${cx},${cy - 4} ${cx + 4},${cy} ${cx},${cy + 4} ${cx - 4},${cy}`}
                              fill="#FFD700"
                              pointerEvents="none"
                              style={{ filter: 'drop-shadow(0 0 3px rgba(255,215,0,0.6))' }}
                            />
                          ) : (
                            <circle cx={cx} cy={cy} r={isHov ? 5 : 3.5} fill={color} pointerEvents="none" />
                          )}
                          {!isPR && isHov && <circle cx={cx} cy={cy} r="9" fill={color} fillOpacity="0.18" pointerEvents="none" />}

                          {/* Individual tooltip for single-series mode */}
                          {!compareMode && isHov && (() => {
                            const tipX = Math.min(Math.max(cx, PAD.left + 60), W - PAD.right - 60)
                            const tipY = cy - 36
                            return (
                              <g pointerEvents="none">
                                <rect x={tipX - 60} y={tipY} width="120" height="22" rx="4" fill="#0F0F1A" stroke="#1C1C2E" />
                                <text x={tipX} y={tipY + 14} textAnchor="middle" fontSize="10" fill="#E8E8F0" className="font-mono">
                                  {session.log_date.slice(5)} · {isPR ? '🏆 ' : ''}{formatTooltipValue(val, key, session, wt)}
                                </text>
                              </g>
                            )
                          })()}

                          {/* Hit target — uses cy (with compare-mode offset) so it aligns with the dot */}
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

              {/* Fix 6: Combined tooltip for compare mode */}
              {compareMode && hovered != null && (() => {
                const i = hovered.sessionIdx
                const session = sessions[i]
                const cx = px(i)

                const entries = activeSeries
                  .map(k => {
                    const val = seriesValues[k][i]
                    if (val == null) return null
                    return { key: k, val, label: seriesOptions.find(o => o.key === k)?.label || k }
                  })
                  .filter(Boolean)

                if (entries.length === 0) return null

                const LINE_H = 13
                const PAD_V  = 8
                const TIP_W  = 164
                const TIP_H  = LINE_H + PAD_V + entries.length * LINE_H
                const tipX = Math.min(Math.max(cx, PAD.left + TIP_W / 2), W - PAD.right - TIP_W / 2)
                const minCy = Math.min(...entries.map(e => py(e.val) + getDotOffset(e.key, i)))
                const tipY = Math.max(PAD.top - 4, minCy - TIP_H - 8)

                return (
                  <g>
                    <rect x={tipX - TIP_W / 2} y={tipY} width={TIP_W} height={TIP_H}
                      rx="4" fill="#0F0F1A" fillOpacity="0.96" stroke="#2D2D4A" />
                    <text x={tipX} y={tipY + LINE_H}
                      textAnchor="middle" fontSize="9" fill="#8080A0" className="font-mono">
                      {session.log_date.slice(5)}
                    </text>
                    {entries.map((e, di) => {
                      const lineY = tipY + LINE_H + PAD_V / 2 + di * LINE_H + LINE_H - 1
                      return (
                        <g key={e.key}>
                          <circle
                            cx={tipX - TIP_W / 2 + 9}
                            cy={lineY - 3}
                            r="3"
                            fill={seriesColor(e.key)}
                          />
                          <text
                            x={tipX - TIP_W / 2 + 17}
                            y={lineY}
                            textAnchor="start"
                            fontSize="9"
                            fill="#D0D0E8"
                            className="font-mono"
                          >
                            {e.label}: {formatCombinedEntry(e.key, e.val, session, wt, viewMode)}
                          </text>
                        </g>
                      )
                    })}
                  </g>
                )
              })()}

              {/* X-axis labels */}
              {xIdxs.map(i => (
                <text key={i} x={px(i)} y={H - 6} textAnchor="middle" fontSize="9"
                  fill="currentColor" fillOpacity="0.4" className="font-mono">
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
