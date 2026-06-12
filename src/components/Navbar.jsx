import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/goals', label: 'Goals' },
  { to: '/masters', label: 'Masters' },
  { to: '/digest', label: 'Digest' },
  { to: '/review', label: 'Review' },
]

export default function Navbar({ dark, onToggleDark }) {
  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: dark ? 'rgba(7,7,18,0.82)' : 'rgba(245,243,238,0.88)',
        borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-between h-13 overflow-x-auto">
        <div className="flex items-center gap-0.5 shrink-0">
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                [
                  'nav-link-hover nav-link-wash relative px-3 py-1.5 text-sm font-body font-medium whitespace-nowrap',
                  isActive ? 'is-active' : '',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  {link.label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                      style={{ backgroundColor: '#6366F1' }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <button
          onClick={onToggleDark}
          className="nav-link-hover ml-4 shrink-0 p-2 rounded-lg text-os-secondary hover:text-os-fg"
          aria-label="Toggle dark mode"
        >
          <i className={`ti ti-${dark ? 'sun' : 'moon'} text-lg`} />
        </button>
      </div>
    </nav>
  )
}
