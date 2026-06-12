export default function AllDoneBanner({ visible }) {
  if (!visible) return null

  return (
    <div className="animate-slide-down mb-6 shimmer-overlay rounded-xl overflow-hidden">
      <div
        className="px-6 py-3.5 text-center"
        style={{
          background: 'linear-gradient(105deg, rgba(16,185,129,0.12) 0%, rgba(6,182,212,0.1) 50%, rgba(16,185,129,0.12) 100%)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'rgba(16,185,129,0.25)',
          borderRadius: 'inherit',
        }}
      >
        <div className="flex items-center justify-center gap-2.5">
          <i className="ti ti-lock text-emerald-400 dark:text-emerald-300 text-base" />
          <span className="font-display font-semibold text-sm tracking-wide text-emerald-700 dark:text-emerald-300">
            All habits done — you're locked in
          </span>
          <i className="ti ti-lock text-emerald-400 dark:text-emerald-300 text-base" />
        </div>
      </div>
    </div>
  )
}
