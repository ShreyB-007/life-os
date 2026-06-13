import { useState } from 'react'

function getMetricValue(log, weightType) {
  if (!log.sets || log.sets.length === 0) return null
  const s = log.sets
  if (weightType === 'barbell' || weightType === 'dumbbell' || weightType === 'cable') {
    return Math.max(...s.map(x => x.weight || 0))
  }
  if (weightType === 'reps') {
    return s.reduce((sum, x) => sum + (x.reps || 0), 0)
  }
  if (weightType === 'time') {
    return Math.max(...s.map(x => x.duration || 0))
  }
  return null
}

function getYLabel(weightType) {
  if (weightType === 'barbell' || weightType === 'dumbbell' || weightType === 'cable') return 'Max weight (kg)'
  if (weightType === 'reps') return 'Total reps'
  return 'Longest set (s)'
}

function formatValue(value, weightType) {
  if (weightType === 'time') {
    const m = Math.floor(value / 60)
    const s = value % 60
    return m > 0 ? `${m}m${s > 0 ? s + 's' : ''}` : `${s}s`
  }
  return String(value)
}

const W = 480
const H = 220
const PAD = { top: 24, right: 24, bottom: 36, left: 48 }
const CW = W - PAD.left - PAD.right
const CH = H - PAD.top - PAD.bottom

export default function ProgressGraph({ exercise, logs, onClose }) {
  const [hovered, setHovered] = useState(null)

  const points = logs
    .map(l => ({ date: l.log_date, value: getMetricValue(l, exercise.weight_type) }))
    .filter(p => p.value !== null)
    .reverse()

  const hasEnough = points.length >= 2

  const minY = hasEnough ? Math.min(...points.map(p => p.value)) : 0
  const maxY = hasEnough ? Math.max(...points.map(p => p.value)) : 1
  const rangeY = maxY === minY ? 1 : maxY - minY

  const padY = rangeY * 0.1
  const domainMin = minY - padY
  const domainMax = maxY + padY
  const domainRange = domainMax - domainMin

  const px = i => PAD.left + (points.length === 1 ? CW / 2 : (i / (points.length - 1)) * CW)
  const py = v => PAD.top + CH - ((v - domainMin) / domainRange) * CH

  const pathD = hasEnough
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(p.value).toFixed(1)}`).join(' ')
    : ''

  const areaD = hasEnough
    ? `${pathD} L${px(points.length - 1).toFixed(1)},${(PAD.top + CH).toFixed(1)} L${px(0).toFixed(1)},${(PAD.top + CH).toFixed(1)} Z`
    : ''

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(t => domainMin + t * domainRange)

  // X-axis label indices: first, last, and up to 3 in between
  const xIdxs = points.length <= 5
    ? points.map((_, i) => i)
    : Array.from(new Set([0, Math.round(points.length / 4), Math.round(points.length / 2), Math.round(3 * points.length / 4), points.length - 1]))

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        style={{ zIndex: 200 }}
        onClick={onClose}
      />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 w-full max-w-lg mx-4"
        style={{ zIndex: 201, background: 'var(--drawer-bg)', border: '1px solid var(--drawer-card-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display font-semibold text-sm text-os-fg">{exercise.name}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-os-muted hover:text-os-fg transition-colors"
          >
            <i className="ti ti-x text-base" />
          </button>
        </div>
        <p className="text-xs font-body text-os-muted mb-4">{getYLabel(exercise.weight_type)}</p>

        {!hasEnough ? (
          <div className="flex items-center justify-center h-32 text-sm font-body text-os-muted text-center px-4">
            Log at least 2 sessions to see your progress
          </div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200, overflow: 'visible' }}>
            {/* Grid lines + Y labels */}
            {gridVals.map((val, ti) => {
              const y = py(val)
              return (
                <g key={ti}>
                  <line
                    x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                    stroke="currentColor" strokeOpacity="0.07" strokeWidth="1"
                    className="text-zinc-700 dark:text-white"
                  />
                  <text
                    x={PAD.left - 6} y={y + 4}
                    textAnchor="end" fontSize="9"
                    fill="currentColor" fillOpacity="0.4"
                    className="font-mono"
                  >
                    {Math.round(val)}
                  </text>
                </g>
              )
            })}

            {/* Area fill */}
            <path d={areaD} fill="rgba(99,102,241,0.08)" />

            {/* Line */}
            <path
              d={pathD}
              fill="none"
              stroke="#6366F1"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Dots + hover targets */}
            {points.map((p, i) => {
              const cx = px(i)
              const cy = py(p.value)
              const isHov = hovered === i
              // clamp tooltip so it doesn't overflow
              const tipX = Math.min(Math.max(cx, PAD.left + 45), W - PAD.right - 45)
              const tipY = cy - 34

              return (
                <g key={i}>
                  <circle cx={cx} cy={cy} r={isHov ? 5 : 4} fill="#6366F1" />
                  {isHov && <circle cx={cx} cy={cy} r="8" fill="rgba(99,102,241,0.2)" />}
                  {isHov && (
                    <g>
                      <rect x={tipX - 45} y={tipY} width="90" height="22" rx="4" fill="#0F0F1A" stroke="#1C1C2E" />
                      <text x={tipX} y={tipY + 14} textAnchor="middle" fontSize="10" fill="#E8E8F0" className="font-mono">
                        {p.date.slice(5)} · {formatValue(p.value, exercise.weight_type)}
                      </text>
                    </g>
                  )}
                  {/* Invisible large hit area */}
                  <circle
                    cx={cx} cy={cy} r="14" fill="transparent"
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: 'crosshair' }}
                  />
                </g>
              )
            })}

            {/* X-axis labels */}
            {xIdxs.map(i => (
              <text
                key={i}
                x={px(i)} y={H - 6}
                textAnchor="middle" fontSize="9"
                fill="currentColor" fillOpacity="0.4"
                className="font-mono"
              >
                {points[i].date.slice(5)}
              </text>
            ))}
          </svg>
        )}
      </div>
    </>
  )
}
