export default function DeleteConfirmModal({ exercise, bodyText, confirmText, title, onConfirm, onCancel }) {
  const defaultBody = 'This will permanently remove this exercise and all its logged sessions. This cannot be undone.'

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        style={{ zIndex: 300 }}
        onClick={onCancel}
      />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 w-full max-w-sm mx-4"
        style={{ zIndex: 301, background: 'var(--drawer-bg)', border: '1px solid var(--drawer-card-border)' }}
      >
        <h3 className="font-display font-semibold text-base text-os-fg mb-2">
          {title || `Delete ${exercise.name}?`}
        </h3>
        <p className="text-sm font-body text-os-secondary mb-5 leading-relaxed">
          {bodyText || defaultBody}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg text-sm font-body font-medium transition-colors text-os-secondary hover:text-os-fg"
            style={{ border: '1px solid var(--drawer-card-border)' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-lg text-sm font-body font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
          >
            {confirmText || 'Delete permanently'}
          </button>
        </div>
      </div>
    </>
  )
}
