import { useState, useEffect } from 'react'
import { getStreakTier } from '../lib/streaks'

const tierConfig = {
  cold: {
    color: '#4A4A60',
    filter: 'none',
    animation: '',
  },
  warm: {
    color: '#F59E0B',
    filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.6))',
    animation: 'animate-pulse-warm',
  },
  hot: {
    color: '#F97316',
    filter: 'drop-shadow(0 0 10px rgba(249,115,22,0.7))',
    animation: 'animate-pulse-hot',
  },
  legendary: {
    color: '#8B5CF6',
    filter: 'drop-shadow(0 0 12px rgba(139,92,246,0.8))',
    animation: 'animate-pulse-legendary',
  },
}

export default function StreakDisplay({ count, flash = false }) {
  const tier = getStreakTier(count)
  const { color, filter, animation } = tierConfig[tier]
  const [flashing, setFlashing] = useState(false)

  // Briefly flash the streak number when a habit transitions to done
  useEffect(() => {
    if (!flash) return
    setFlashing(true)
    const t = setTimeout(() => setFlashing(false), 400)
    return () => clearTimeout(t)
  }, [flash])

  return (
    <div
      className={[
        'flex items-center gap-1.5',
        flashing ? 'animate-streak-flash' : animation,
      ].join(' ')}
    >
      <span
        className="font-mono font-semibold leading-none"
        style={{ fontSize: '20px', color, filter }}
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
