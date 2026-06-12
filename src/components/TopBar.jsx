import { getGreeting, formatDate } from '../lib/date'
import { getStreakTier, getNextMilestone } from '../lib/streaks'

const TIER_LABELS = {
  warm: 'warm',
  hot: 'hot',
  legendary: 'legendary',
}

export default function TopBar({ overallStreak, gymStreak }) {
  const tier = getStreakTier(overallStreak)
  const next = getNextMilestone(overallStreak)
  const now = new Date()

  return (
    <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
      {/* Left: greeting + date */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-gray-100">
          {getGreeting()}, Shrey
        </h1>
        <p className="text-sm text-zinc-500 dark:text-gray-400 mt-0.5">{formatDate(now)}</p>
      </div>

      {/* Right: streak pill + milestone */}
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 rounded-full px-3 py-1.5">
          <i className="ti ti-flame text-amber-500 dark:text-amber-400 text-base" />
          <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
            Day {overallStreak} streak
          </span>
          {tier !== 'cold' && TIER_LABELS[tier] && (
            <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 dark:bg-amber-500/30 text-amber-800 dark:text-amber-200 rounded-full px-1.5 py-0.5">
              {TIER_LABELS[tier]}
            </span>
          )}
        </div>
        {next && (
          <p className="text-xs text-zinc-400 dark:text-gray-500">
            {next.daysRemaining} more {next.daysRemaining === 1 ? 'day' : 'days'} to {next.milestone}-day milestone
          </p>
        )}
      </div>
    </div>
  )
}
