import { useEffect, useRef } from 'react'

const ICONS = [
  // Original 5
  {
    icon: 'barbell',
    top: '6%', right: '5%',
    size: 160, color: '#6366F1', opacity: 0.08,
    animation: 'iconDrift1 26s ease-in-out infinite',
  },
  {
    icon: 'language',
    top: '62%', left: '2%',
    size: 140, color: '#8B5CF6', opacity: 0.07,
    animation: 'iconDrift2 32s ease-in-out infinite',
  },
  {
    icon: 'code',
    top: '38%', right: '10%',
    size: 120, color: '#06B6D4', opacity: 0.08,
    animation: 'iconDrift3 23s ease-in-out infinite',
  },
  {
    icon: 'brain',
    top: '14%', left: '7%',
    size: 170, color: '#6366F1', opacity: 0.06,
    animation: 'iconDrift4 29s ease-in-out infinite',
  },
  {
    icon: 'flame',
    top: '76%', right: '4%',
    size: 130, color: '#F59E0B', opacity: 0.08,
    animation: 'iconDrift5 20s ease-in-out infinite',
  },
  // New additions
  {
    icon: 'atom',
    top: '48%', left: '5%',
    size: 145, color: '#06B6D4', opacity: 0.07,
    animation: 'iconDrift6 35s ease-in-out infinite',
  },
  {
    icon: 'satellite',
    top: '22%', right: '24%',
    size: 115, color: '#8B5CF6', opacity: 0.07,
    animation: 'iconDrift7 27s ease-in-out infinite',
  },
  {
    icon: 'compass',
    top: '86%', left: '30%',
    size: 125, color: '#6366F1', opacity: 0.07,
    animation: 'iconDrift8 24s ease-in-out infinite',
  },
]

const PULL_DIST = 120
const PULL_MAX = 14  // max px the icon leans toward cursor

export default function FloatingIcons() {
  const iconRefs = useRef([])

  useEffect(() => {
    function onMove(e) {
      const cx = e.clientX
      const cy = e.clientY
      iconRefs.current.forEach(el => {
        if (!el) return
        const rect = el.getBoundingClientRect()
        const mx = rect.left + rect.width / 2
        const my = rect.top + rect.height / 2
        const dx = cx - mx
        const dy = cy - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > PULL_DIST || dist === 0) {
          el.style.translate = '0px 0px'
        } else {
          const strength = (1 - dist / PULL_DIST) * PULL_MAX
          el.style.translate = `${((dx / dist) * strength).toFixed(2)}px ${((dy / dist) * strength).toFixed(2)}px`
        }
      })
    }

    function onLeave() {
      iconRefs.current.forEach(el => {
        if (el) el.style.translate = '0px 0px'
      })
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 1 }}
    >
      {ICONS.map(({ icon, size, color, opacity, animation, ...pos }, i) => (
        <i
          key={icon}
          ref={el => { iconRefs.current[i] = el }}
          className={`ti ti-${icon}`}
          style={{
            position: 'absolute',
            ...pos,
            fontSize: `${size}px`,
            color,
            opacity,
            animation,
            lineHeight: 1,
            transition: 'translate 600ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            willChange: 'translate',
          }}
        />
      ))}
    </div>
  )
}
