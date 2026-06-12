export default function BottomRow({ goals }) {
  const nextMilestoneGoal = goals
    ?.filter(g => g.target_date && g.status === 'active')
    .sort((a, b) => new Date(a.target_date) - new Date(b.target_date))[0]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* AI Digest card */}
      <div className="rounded-xl border border-zinc-200 dark:border-void-800 bg-white dark:bg-void-900 p-4 transition-colors duration-150 hover:dark:border-void-700">
        <div className="flex items-center gap-2 mb-2">
          <i className="ti ti-news text-zinc-400 dark:text-slate-600 text-base" />
          <span className="text-sm font-display font-semibold text-zinc-700 dark:text-slate-300">Today's AI digest</span>
        </div>
        <p className="text-xs font-body text-zinc-400 dark:text-slate-600">AI Digest coming in Phase 3</p>
      </div>

      {/* Next milestone card */}
      <div className="rounded-xl border border-zinc-200 dark:border-void-800 bg-white dark:bg-void-900 p-4 transition-colors duration-150 hover:dark:border-void-700">
        <div className="flex items-center gap-2 mb-2">
          <i className="ti ti-flag text-zinc-400 dark:text-slate-600 text-base" />
          <span className="text-sm font-display font-semibold text-zinc-700 dark:text-slate-300">Next milestone</span>
        </div>
        {nextMilestoneGoal ? (
          <>
            <div className="flex items-center gap-2">
              <i
                className={`ti ti-${nextMilestoneGoal.icon} text-sm`}
                style={{ color: nextMilestoneGoal.color }}
              />
              <span className="text-sm font-body text-zinc-700 dark:text-slate-300">{nextMilestoneGoal.name}</span>
              <span
                className="text-[11px] font-body font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: nextMilestoneGoal.color + '22',
                  color: nextMilestoneGoal.color,
                }}
              >
                {nextMilestoneGoal.label}
              </span>
            </div>
            <p className="text-[11px] font-body text-zinc-400 dark:text-slate-600 mt-1.5">Tap Goals to update progress</p>
          </>
        ) : (
          <p className="text-xs font-body text-zinc-400 dark:text-slate-600">No upcoming milestones</p>
        )}
      </div>
    </div>
  )
}
