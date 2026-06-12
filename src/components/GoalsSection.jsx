import { useState, useEffect } from 'react'

export default function GoalsSection({ goals }) {
  if (!goals || goals.length === 0) return null

  return (
    <div className="mb-6">
      <p className="text-[11px] font-body font-semibold uppercase tracking-widest mb-3" style={{ color: '#4A4A60' }}>
        Goals
      </p>
      <div className="flex flex-col gap-2">
        {goals.map((goal, i) => (
          <GoalRow key={goal.id} goal={goal} index={i} />
        ))}
      </div>
    </div>
  )
}

function GoalRow({ goal, index }) {
  const { name, icon, color, progress_pct, label } = goal
  const [shineMounted, setShineMounted] = useState(false)

  // Trigger shine once on mount, staggered by index
  useEffect(() => {
    const t = setTimeout(() => setShineMounted(true), 50 + index * 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="card-interactive flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ background: '#0F0F1A', border: '1px solid #1C1C2E' }}
    >
      {/* Icon */}
      <i className={`ti ti-${icon} text-sm shrink-0`} style={{ color }} />

      {/* Name */}
      <span className="text-sm font-body w-36 truncate shrink-0" style={{ color: '#8888A0' }}>
        {name}
      </span>

      {/* Progress bar */}
      <div className="relative flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: '#1C1C2E' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress_pct}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}50`,
          }}
        />
        {shineMounted && (
          <div
            className="bar-shine"
            style={{ animationDelay: `${index * 100}ms` }}
          />
        )}
      </div>

      {/* Percentage */}
      <span className="text-xs font-mono w-8 text-right shrink-0 tabular-nums" style={{ color: '#4A4A60' }}>
        {progress_pct}%
      </span>

      {/* Label badge */}
      <span
        className="text-[11px] font-body font-medium px-2 py-0.5 rounded-full shrink-0"
        style={{ backgroundColor: color + '22', color }}
      >
        {label}
      </span>
    </div>
  )
}
