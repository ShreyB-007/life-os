import { getGreeting, formatDate } from '../lib/date'
import { getStreakTier, getNextMilestone } from '../lib/streaks'

const TIER_CONFIG = {
  cold: {
    label: null,
    numberStyle: { color: 'var(--os-muted)' },
    flameFilter: 'none',
    flameColor: 'var(--os-muted)',
  },
  warm: {
    label: 'warm',
    numberClass: 'text-gradient-amber',
    flameFilter: 'drop-shadow(0 0 8px rgba(245,158,11,0.6))',
    flameColor: '#F59E0B',
    badgeBg: 'rgba(245,158,11,0.12)',
    badgeColor: '#F59E0B',
  },
  hot: {
    label: 'hot',
    numberClass: 'text-gradient-hot',
    flameFilter: 'drop-shadow(0 0 10px rgba(249,115,22,0.7))',
    flameColor: '#F97316',
    badgeBg: 'rgba(249,115,22,0.12)',
    badgeColor: '#F97316',
  },
  legendary: {
    label: 'legendary',
    numberClass: 'text-gradient-legendary',
    flameFilter: 'drop-shadow(0 0 12px rgba(139,92,246,0.8))',
    flameColor: '#8B5CF6',
    badgeBg: 'rgba(139,92,246,0.15)',
    badgeColor: '#A78BFA',
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
        <h1 className="font-display text-[28px] font-bold leading-tight text-os-fg tracking-tight">
          {getGreeting()}, Shrey
        </h1>
        <p className="text-sm font-body text-os-muted mt-1 tracking-wide">{formatDate(now)}</p>
      </div>

      {/* Right: streak display */}
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-3">
          <div className="relative flex items-end gap-2">
            {tier === 'legendary' && (
              <span
                className="absolute inset-0 rounded-full animate-legendary-ring"
                style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)' }}
              />
            )}
            <span
              className={['font-display font-bold leading-none', cfg.numberClass || ''].join(' ')}
              style={{ fontSize: '52px', lineHeight: 1, ...(tier === 'cold' ? cfg.numberStyle : {}) }}
            >
              {overallStreak}
            </span>
            <i
              className={['ti ti-flame mb-1', tier === 'legendary' ? 'animate-float' : ''].join(' ')}
              style={{ fontSize: '28px', color: cfg.flameColor, filter: cfg.flameFilter }}
            />
          </div>

          {cfg.label && (
            <span
              className="self-start mt-2 text-[10px] font-body font-semibold uppercase tracking-widest px-2 py-0.5 rounded"
              style={{ backgroundColor: cfg.badgeBg, color: cfg.badgeColor }}
            >
              {cfg.label}
            </span>
          )}
        </div>

        <p className="text-[11px] font-body uppercase tracking-widest text-os-muted">
          day streak
        </p>

        {next && (
          <p className="text-[11px] font-body text-os-muted">
            {next.daysRemaining} more to {next.milestone}-day milestone
          </p>
        )}
      </div>
    </div>
  )
}
