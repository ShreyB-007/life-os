import { useState } from 'react'

const WEIGHT_TYPES = [
  { key: 'barbell',  label: 'Barbell' },
  { key: 'dumbbell', label: 'Dumbbell' },
  { key: 'cable',    label: 'Cable' },
  { key: 'reps',     label: 'Reps only' },
  { key: 'time',     label: 'Time' },
]

export default function AddExerciseModal({ workoutType, onAdd, onClose }) {
  const [name, setName] = useState('')
  const [weightType, setWeightType] = useState('barbell')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    const result = await onAdd(trimmed, weightType)
    setSaving(false)
    if (result === 'duplicate') {
      setError(`This exercise already exists in ${workoutType}`)
    } else if (result === 'error') {
      setError('Something went wrong. Try again.')
    } else {
      onClose()
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        style={{ zIndex: 300 }}
        onClick={onClose}
      />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 w-full max-w-sm mx-4"
        style={{ zIndex: 301, background: 'var(--drawer-bg)', border: '1px solid var(--drawer-card-border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-sm text-os-fg">
            Add exercise — {workoutType}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-os-muted hover:text-os-fg transition-colors"
          >
            <i className="ti ti-x text-base" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-body text-os-muted block mb-1.5">
              Exercise name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(null) }}
              placeholder="e.g. Bench Press"
              autoFocus
              className="drawer-input w-full"
            />
          </div>

          <div>
            <label className="text-xs font-body text-os-muted block mb-1.5">
              Tracking type
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {WEIGHT_TYPES.map(wt => (
                <button
                  key={wt.key}
                  type="button"
                  onClick={() => setWeightType(wt.key)}
                  className="py-1.5 px-2 rounded-lg text-xs font-body text-center transition-all"
                  style={weightType === wt.key ? {
                    background: 'rgba(99,102,241,0.15)',
                    border: '1px solid rgba(99,102,241,0.4)',
                    color: '#818CF8',
                  } : {
                    background: 'transparent',
                    border: '1px solid var(--drawer-card-border)',
                    color: 'var(--os-secondary)',
                  }}
                >
                  {wt.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs font-body text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-lg text-sm font-body font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: '#6366F1' }}
          >
            {saving ? 'Adding…' : 'Add exercise'}
          </button>
        </form>
      </div>
    </>
  )
}
