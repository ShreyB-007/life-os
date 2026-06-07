export default function AllDoneBanner({ visible }) {
  if (!visible) return null

  return (
    <div className="animate-slide-down mb-6 rounded-xl bg-green-100 dark:bg-green-800/40 border border-green-400 dark:border-green-600 px-6 py-3 text-center">
      <span className="text-green-700 dark:text-green-300 font-medium text-sm">
        All habits done today — you're locked in
      </span>
    </div>
  )
}
