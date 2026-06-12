import { getGreeting, formatDate } from '../lib/date'
import { getStreakTier, getNextMilestone } from '../lib/streaks'

const TIER_CONFIG = {
  cold: {
    label: null,
    numberStyle: { color: '#64748b' },
    flameFilter: 'none',
    flameColor: '#64748b',
  },
  warm: {
    label: 'warm',
    numberClass: 'text-gradient-amber',
    flameFilter: 'drop-shadow(0 0 8px rgba(251,191,36,0.55))',
    flameColor: '#fbbf24',
    badgeBg: 'rgba(251,191,36,0.12)',
    badgeColor: '#fbbf24',
  },
  hot: {
    label: 'hot',
    numberClass: 'text-gradient-hot',
    flameFilter: 'drop-shadow(0 0 12px rgba(249,115,22,0.75))',
    flameColor: '#f97316',
    badgeBg: 'rgba(249,115,22,0.12)',
    badgeColor: '#f97316',
  },
  legendary: {
    label: 'legendary',
    numberClass: 'text-gradient-legendary',
    flameFilter: 'drop-shadow(0 0 16px rgba(251,191,36,1))',
    flameColor: '#fbbf24',
    badgeBg: 'rgba(251,191,36,0.18)',
    badgeColor: '#fbbf24',
  },
}

export default function TopBar({ overallStreak, gymStreak }) {
  const tier = getStreakTier(overallStreak)
  const next = getNextMilestone(overallStreak)
  const cfg = TIER_CONFIG[tier]
  const now = new Date()

  return (
    <div className="flex items-start justify-between mb-8 flex-wrap gap-6">
      {/* Left: greeting + date */}
      <div>
        <h1 className="font-display text-[28px] font-bold leading-tight text-zinc-900 dark:text-white tracking-tight">
          {getGreeting()}, Shrey
        </h1>
        <p className="text-sm font-body text-zinc-400 dark:text-slate-500 mt-1 tracking-wide">{formatDate(now)}</p>
      </div>

      {/* Right: streak display */}
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-3">
          {/* Streak number + flame */}
          <div className="relative flex items-end gap-2">
            {/* Legendary glow ring */}
            {tier === 'legendary' && (
              <span
                className="absolute inset-0 rounded-full animate-legendary-ring"
                style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.3) 0%, transparent 70%)' }}
              />
            )}
            <span
              className={[
                'font-display font-bold leading-none',
                cfg.numberClass || '',
              ].join(' ')}
              style={{
                fontSize: '52px',
                lineHeight: 1,
                ...(tier === 'cold' ? cfg.numberStyle : {}),
              }}
            >
              {overallStreak}
            </span>
            <i
              className={[
                'ti ti-flame mb-1',
                tier === 'legendary' ? 'animate-float' : '',
              ].join(' ')}
              style={{
                fontSize: '28px',
                color: cfg.flameColor,
                filter: cfg.flameFilter,
              }}
            />
          </div>

          {/* Tier badge */}
          {cfg.label && (
            <span
              className="self-start mt-2 text-[10px] font-body font-semibold uppercase tracking-widest px-2 py-0.5 rounded"
              style={{ backgroundColor: cfg.badgeBg, color: cfg.badgeColor }}
            >
              {cfg.label}
            </span>
          )}
        </div>

        <p className="text-[11px] font-body uppercase tracking-widest text-zinc-400 dark:text-slate-600">
          day streak
        </p>

        {next && (
          <p className="text-[11px] font-body text-zinc-400 dark:text-slate-600">
            {next.daysRemaining} more to {next.milestone}-day milestone
          </p>
        )}
      </div>
    </div>
  )
}
