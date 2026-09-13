import { useState, useEffect } from 'react'

export default function GoalsSection({ goals }) {
  if (!goals || goals.length === 0) return null

  return (
    <div className="mb-6">
      <p className="text-[11px] font-body font-semibold uppercase tracking-widest mb-3 text-os-muted">
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

  useEffect(() => {
    const t = setTimeout(() => setShineMounted(true), 50 + index * 100)
    return () => clearTimeout(t)
  }, [index])

  return (
    <div className="habit-card card-interactive flex items-center gap-3 rounded-xl px-4 py-3">
      <i className={`ti ti-${icon} text-sm shrink-0`} style={{ color }} />

      <span
        className="text-sm font-body w-48 truncate shrink-0 text-os-secondary"
        title={name}
      >
        {name}
      </span>

      <div className="relative flex-1 h-[6px] rounded-full overflow-hidden progress-track">
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

      <span className="text-xs font-mono w-8 text-right shrink-0 tabular-nums text-os-muted">
        {progress_pct}%
      </span>

      <span
        className="text-[11px] font-body font-medium px-2 py-0.5 rounded-full shrink-0"
        style={{ backgroundColor: color + '22', color }}
      >
        {label}
      </span>
    </div>
  )
}
