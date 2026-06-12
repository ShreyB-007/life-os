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
      className="sticky top-0 z-50 border-b border-surface-200 dark:border-void-800"
      style={{
        backgroundColor: dark ? 'rgba(7,7,18,0.8)' : 'rgba(250,250,250,0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
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
                  'relative px-3 py-2 text-sm font-body font-medium whitespace-nowrap transition-colors duration-150',
                  isActive
                    ? 'text-zinc-900 dark:text-os-fg'
                    : 'text-zinc-400 dark:text-os-muted hover:text-zinc-700 dark:hover:text-os-secondary',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-indigo-500 dark:bg-os-indigo" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <button
          onClick={onToggleDark}
          className="ml-4 shrink-0 p-2 rounded-lg transition-colors duration-150 text-zinc-400 dark:text-os-muted hover:text-zinc-700 dark:hover:text-os-secondary hover:bg-surface-100 dark:hover:bg-void-850"
          aria-label="Toggle dark mode"
        >
          <i className={`ti ti-${dark ? 'sun' : 'moon'} text-lg`} />
        </button>
      </div>
    </nav>
  )
}
