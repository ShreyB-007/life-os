export default function AllDoneBanner({ visible }) {
  if (!visible) return null

  return (
    <div
      className="animate-slide-down mb-6 relative overflow-hidden rounded-xl"
      style={{
        background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(99,102,241,0.15) 100%)',
        border: '1px solid rgba(16,185,129,0.3)',
      }}
    >
      {/* One-shot shimmer sweep after slide-down completes */}
      <div className="banner-shimmer-once" />

      <div className="relative px-6 py-3.5 text-center">
        <div className="flex items-center justify-center gap-2.5">
          <i className="ti ti-lock text-emerald-400 text-base" />
          <span className="font-display font-semibold text-sm tracking-wide text-emerald-300">
            All habits done — you're locked in
          </span>
          <i className="ti ti-lock text-emerald-400 text-base" />
        </div>
      </div>
    </div>
  )
}
