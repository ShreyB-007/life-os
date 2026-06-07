export default function GoalsSection({ goals }) {
  if (!goals || goals.length === 0) return null

  return (
    <div className="mb-6">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-gray-500 mb-3">
        Goals
      </p>
      <div className="flex flex-col gap-1.5">
        {goals.map(goal => (
          <GoalRow key={goal.id} goal={goal} />
        ))}
      </div>
    </div>
  )
}

function GoalRow({ goal }) {
  const { name, icon, color, progress_pct, label } = goal

  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2.5">
      {/* Icon */}
      <i
        className={`ti ti-${icon} text-sm shrink-0`}
        style={{ color }}
      />

      {/* Name */}
      <span className="text-sm text-zinc-700 dark:text-gray-300 w-36 truncate shrink-0">
        {name}
      </span>

      {/* Progress bar */}
      <div className="flex-1 h-1 rounded-full bg-zinc-200 dark:bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress_pct}%`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* Percentage */}
      <span className="text-xs text-zinc-500 dark:text-gray-500 w-8 text-right shrink-0 tabular-nums">
        {progress_pct}%
      </span>

      {/* Label badge */}
      <span
        className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
        style={{
          backgroundColor: color + '22',
          color,
        }}
      >
        {label}
      </span>
    </div>
  )
}
