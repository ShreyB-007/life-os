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
    <nav className="sticky top-0 z-50 border-b bg-white dark:bg-gray-950 border-zinc-200 dark:border-gray-800">
      <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-between h-14 overflow-x-auto">
        <div className="flex items-center gap-1 shrink-0">
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                [
                  'px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors duration-150',
                  isActive
                    ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white pb-[2px]'
                    : 'text-zinc-500 dark:text-gray-400 hover:text-zinc-800 dark:hover:text-gray-200',
                ].join(' ')
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <button
          onClick={onToggleDark}
          className="ml-4 shrink-0 p-2 rounded-lg transition-colors duration-150 text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-gray-100 hover:bg-zinc-100 dark:hover:bg-gray-800"
          aria-label="Toggle dark mode"
        >
          <i className={`ti ti-${dark ? 'sun' : 'moon'} text-lg`} />
        </button>
      </div>
    </nav>
  )
}
