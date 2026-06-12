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
    <nav className="sticky top-0 z-50 border-b bg-white dark:bg-void-950 border-zinc-200 dark:border-void-800 backdrop-blur-sm">
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
                    ? 'text-zinc-900 dark:text-white'
                    : 'text-zinc-500 dark:text-slate-500 hover:text-zinc-800 dark:hover:text-slate-300',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-amber-500 dark:bg-amber-400" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <button
          onClick={onToggleDark}
          className="ml-4 shrink-0 p-2 rounded-lg transition-colors duration-150 text-zinc-400 dark:text-slate-500 hover:text-zinc-900 dark:hover:text-slate-200 hover:bg-zinc-100 dark:hover:bg-void-800"
          aria-label="Toggle dark mode"
        >
          <i className={`ti ti-${dark ? 'sun' : 'moon'} text-lg`} />
        </button>
      </div>
    </nav>
  )
}
