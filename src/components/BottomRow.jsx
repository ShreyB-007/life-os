export default function BottomRow({ goals }) {
  const nextMilestoneGoal = goals
    ?.filter(g => g.target_date && g.status === 'active')
    .sort((a, b) => new Date(a.target_date) - new Date(b.target_date))[0]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* AI Digest card */}
      <div className="rounded-xl border border-zinc-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center gap-2 mb-2">
          <i className="ti ti-news text-zinc-400 dark:text-gray-400 text-base" />
          <span className="text-sm font-semibold text-zinc-800 dark:text-gray-300">Today's AI digest</span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-gray-500">AI Digest coming in Phase 3</p>
      </div>

      {/* Next milestone card */}
      <div className="rounded-xl border border-zinc-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center gap-2 mb-2">
          <i className="ti ti-flag text-zinc-400 dark:text-gray-400 text-base" />
          <span className="text-sm font-semibold text-zinc-800 dark:text-gray-300">Next milestone</span>
        </div>
        {nextMilestoneGoal ? (
          <>
            <div className="flex items-center gap-2">
              <i
                className={`ti ti-${nextMilestoneGoal.icon} text-sm`}
                style={{ color: nextMilestoneGoal.color }}
              />
              <span className="text-sm text-zinc-800 dark:text-gray-200">{nextMilestoneGoal.name}</span>
              <span
                className="text-[11px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: nextMilestoneGoal.color + '22',
                  color: nextMilestoneGoal.color,
                }}
              >
                {nextMilestoneGoal.label}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-gray-500 mt-1.5">Tap Goals to update progress</p>
          </>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-gray-500">No upcoming milestones</p>
        )}
      </div>
    </div>
  )
}
