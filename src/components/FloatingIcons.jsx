const ICONS = [
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
]

export default function FloatingIcons() {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 1 }}
    >
      {ICONS.map(({ icon, size, color, opacity, animation, ...pos }) => (
        <i
          key={icon}
          className={`ti ti-${icon}`}
          style={{
            position: 'absolute',
            ...pos,
            fontSize: `${size}px`,
            color,
            opacity,
            animation,
            lineHeight: 1,
          }}
        />
      ))}
    </div>
  )
}
