import { getStreakTier } from '../lib/streaks'

const tierStyles = {
  cold: {
    color: '#6b7280',
    animation: '',
  },
  warm: {
    color: '#f59e0b',
    animation: 'animate-pulse-warm',
  },
  hot: {
    color: '#f97316',
    animation: 'animate-pulse-hot',
  },
  legendary: {
    color: '#dc2626',
    animation: 'animate-pulse-legendary',
  },
}

export default function StreakDisplay({ count }) {
  const tier = getStreakTier(count)
  const { color, animation } = tierStyles[tier]

  return (
    <div className={`flex items-center gap-1 ${animation}`} style={{ color }}>
      <span className="text-[22px] font-medium leading-none">{count}</span>
      <i className="ti ti-flame text-lg leading-none" />
    </div>
  )
}
