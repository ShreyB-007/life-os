import { getStreakTier } from '../lib/streaks'

const tierConfig = {
  cold: {
    color: '#475569',
    filter: 'none',
    animation: '',
  },
  warm: {
    color: '#fbbf24',
    filter: 'drop-shadow(0 0 5px rgba(251,191,36,0.5))',
    animation: 'animate-pulse-warm',
  },
  hot: {
    color: '#f97316',
    filter: 'drop-shadow(0 0 7px rgba(249,115,22,0.65))',
    animation: 'animate-pulse-hot',
  },
  legendary: {
    color: '#fbbf24',
    filter: 'drop-shadow(0 0 10px rgba(251,191,36,0.9))',
    animation: 'animate-pulse-legendary',
  },
}

export default function StreakDisplay({ count }) {
  const tier = getStreakTier(count)
  const { color, filter, animation } = tierConfig[tier]

  return (
    <div className={`flex items-center gap-1.5 ${animation}`}>
      <span
        className="font-mono font-semibold leading-none"
        style={{ fontSize: '20px', color }}
      >
        {count}
      </span>
      <i
        className="ti ti-flame leading-none"
        style={{ fontSize: '17px', color, filter }}
      />
    </div>
  )
}
