import { useState } from 'react'

const W = 480, H = 220
const PAD = { top: 24, right: 24, bottom: 36, left: 36 }
const CW = W - PAD.left - PAD.right
const CH = H - PAD.top - PAD.bottom

const SERIES = [
  { key: 'easy', label: 'Easy', color: '#10B981' },
  { key: 'med', label: 'Med', color: '#F59E0B' },
  { key: 'hard', label: 'Hard', color: '#EF4444' },
]

function fmtShortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function computeTicks(maxVal) {
  const yMax = Math.max(1, Math.ceil(maxVal * 1.15))
  function genTicks(step) {
    const ticks = []
    for (let v = 0; v <= yMax + 0.001; v += step) ticks.push(Math.round(v))
    return ticks
  }
  let ticks = genTicks(1)
  if (ticks.length > 8) ticks = genTicks(2)
  if (ticks.length > 8) ticks = genTicks(5)
  if (ticks.length > 8) ticks = genTicks(10)
  return { ticks, yMax }
}

export default function DSAProgressGraph({ allLogs, onClose }) {
  const [hovered, setHovered] = useState(null)

  const sessions = (allLogs || [])
    .filter(l => l.done === true)
    .slice()
    .sort((a, b) => a.log_date.localeCompare(b.log_date))

  const n = sessions.length

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ zIndex: 200 }} onClick={onClose} />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 w-[90vw] max-w-[900px]"
        style={{ zIndex: 201, background: 'var(--drawer-bg)', border: '1px solid var(--drawer-card-border)', height: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display font-semibold text-sm text-os-fg">DSA Progress</h3>
          <button onClick={onClose} className="p-1.5 rounded-md text-os-muted hover:text-os-fg transition-colors">
            <i className="ti ti-x text-base" />
          </button>
        </div>
        <p className="text-xs font-body text-os-muted mb-4">Questions</p>

        {n < 2 ? (
          <div className="flex items-center justify-center h-32 text-sm font-body text-os-muted text-center px-4">
            Log at least 2 DSA sessions to see your progress
          </div>
        ) : (() => {
          const data = sessions.map(s => ({
            date: s.log_date,
            easy: s.payload?.easy || 0,
            med: s.payload?.med || 0,
            hard: s.payload?.hard || 0,
          }))

          const maxVal = Math.max(...data.flatMap(d => [d.easy, d.med, d.hard]))
          const { ticks: gridVals, yMax } = computeTicks(maxVal)

          const px = i => PAD.left + (n <= 1 ? CW / 2 : (i / (n - 1)) * CW)
          const py = v => PAD.top + CH - (v / (yMax || 1)) * CH

          const xIdxs = n <= 5
            ? data.map((_, i) => i)
            : Array.from(new Set([0, Math.round(n / 4), Math.round(n / 2), Math.round(3 * n / 4), n - 1]))

          const hitWidth = n > 1 ? CW / (n - 1) : CW

          function pathFor(key) {
            return data.map((d, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(d[key]).toFixed(1)}`).join(' ')
          }

          return (
            <>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'max(220px, 55vh)', overflow: 'visible' }}>
                {gridVals.map((val, ti) => {
                  const y = py(val)
                  return (
                    <g key={ti}>
                      <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                        stroke="currentColor" strokeOpacity="0.07" strokeWidth="1"
                        className="text-zinc-700 dark:text-white" />
                      <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="9"
                        fill="currentColor" fillOpacity="0.4" className="font-mono">
                        {val}
                      </text>
                    </g>
                  )
                })}

                {SERIES.map(({ key, color }) => (
                  <path key={key} d={pathFor(key)} fill="none" stroke={color} strokeWidth="2"
                    strokeLinejoin="round" strokeLinecap="round" />
                ))}

                {data.map((d, i) => {
                  const isHov = hovered === i
                  const cx = px(i)
                  return (
                    <g key={i}>
                      {SERIES.map(({ key, color }) => (
                        <circle key={key} cx={cx} cy={py(d[key])} r={isHov ? 5 : 3.5} fill={color} pointerEvents="none" />
                      ))}

                      {isHov && (() => {
                        const minCy = Math.min(...SERIES.map(s => py(d[s.key])))
                        const label = `${fmtShortDate(d.date)} — Easy: ${d.easy} · Med: ${d.med} · Hard: ${d.hard}`
                        const tipW = 190
                        const tipX = Math.min(Math.max(cx, PAD.left + tipW / 2), W - PAD.right - tipW / 2)
                        const tipY = Math.max(PAD.top - 4, minCy - 30)
                        return (
                          <g pointerEvents="none">
                            <rect x={tipX - tipW / 2} y={tipY} width={tipW} height={22} rx="4" fill="#0F0F1A" stroke="#1C1C2E" />
                            <text x={tipX} y={tipY + 14} textAnchor="middle" fontSize="9" fill="#E8E8F0" className="font-mono">
                              {label}
                            </text>
                          </g>
                        )
                      })()}

                      <rect
                        x={cx - hitWidth / 2} y={PAD.top}
                        width={hitWidth} height={CH}
                        fill="transparent"
                        style={{ cursor: 'crosshair' }}
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(null)}
                      />
                    </g>
                  )
                })}

                {xIdxs.map(i => (
                  <text key={i} x={px(i)} y={H - 6} textAnchor="middle" fontSize="9"
                    fill="currentColor" fillOpacity="0.4" className="font-mono">
                    {fmtShortDate(data[i].date)}
                  </text>
                ))}
              </svg>

              <div className="flex flex-wrap gap-4 mt-3">
                {SERIES.map(({ key, label, color }) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: color }} />
                    <span className="text-[11px] font-body text-os-secondary">{label}</span>
                  </div>
                ))}
              </div>
            </>
          )
        })()}
      </div>
    </>
  )
}
