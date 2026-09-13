import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <i className="ti ti-map-off text-5xl text-os-muted" />
        <h1 className="font-display text-2xl font-bold text-os-fg">Page not found</h1>
        <p className="text-sm font-body text-os-muted">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <Link
          to="/"
          className="habit-card card-interactive mt-2 rounded-xl px-4 py-2 text-sm font-body font-semibold text-os-fg"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
