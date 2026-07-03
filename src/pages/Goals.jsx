import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  GOAL_COLOR_OPTIONS,
  GOAL_ICON_OPTIONS,
  buildDefaultGoal,
  clampProgress,
  compareDateStrings,
  formatTargetDate,
} from '../lib/goals'

const STATUS_OPTIONS = ['active', 'paused', 'complete']

export default function Goals() {
  const [goals, setGoals] = useState([])
  const [draft, setDraft] = useState(() => buildDefaultGoal(1))
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchGoals()
  }, [])

  async function fetchGoals() {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('goals')
      .select('*')
      .order('sort_order', { ascending: true })

    if (fetchError) {
      setError('Could not load goals.')
      setLoading(false)
      return
    }

    setGoals(data ?? [])
    setDraft(buildDefaultGoal((data?.length ?? 0) + 1))
    setLoading(false)
  }

  const activeGoals = useMemo(
    () =>
      goals
        .filter(goal => goal.status === 'active')
        .sort((a, b) => compareDateStrings(a.target_date, b.target_date)),
    [goals],
  )

  const completeCount = goals.filter(goal => goal.status === 'complete').length
  const averageProgress =
    goals.length === 0
      ? 0
      : Math.round(
          goals.reduce((sum, goal) => sum + Number(goal.progress_pct ?? 0), 0) /
            goals.length,
        )

  function updateDraft(field, value) {
    setDraft(prev => ({
      ...prev,
      [field]:
        field === 'progress_pct'
          ? clampProgress(value)
          : field === 'sort_order'
            ? Math.max(1, Number.parseInt(value, 10) || 1)
            : value,
    }))
  }

  function startEdit(goal) {
    setEditingId(goal.id)
    setDraft({
      name: goal.name ?? '',
      icon: goal.icon ?? 'target',
      color: goal.color ?? GOAL_COLOR_OPTIONS[0].value,
      progress_pct: goal.progress_pct ?? 0,
      target_date: goal.target_date ?? '',
      label: goal.label ?? '',
      status: goal.status ?? 'active',
      sort_order: goal.sort_order ?? goals.length + 1,
    })
    setError('')
  }

  function resetForm() {
    setEditingId(null)
    setDraft(buildDefaultGoal(goals.length + 1))
    setError('')
  }

  async function saveGoal(event) {
    event.preventDefault()
    const name = draft.name.trim()
    if (!name) {
      setError('Goal name is required.')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      name,
      icon: draft.icon,
      color: draft.color,
      progress_pct: clampProgress(draft.progress_pct),
      target_date: draft.target_date || null,
      label: draft.label.trim() || null,
      status: draft.status,
      sort_order: Number(draft.sort_order) || goals.length + 1,
    }

    const request = editingId
      ? supabase.from('goals').update(payload).eq('id', editingId).select().single()
      : supabase.from('goals').insert(payload).select().single()

    const { data, error: saveError } = await request

    if (saveError) {
      setError('Could not save goal.')
      setSaving(false)
      return
    }

    setGoals(prev => {
      const next = editingId
        ? prev.map(goal => (goal.id === editingId ? data : goal))
        : [...prev, data]
      return next.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    })
    setSaving(false)
    setEditingId(null)
    setDraft(buildDefaultGoal(goals.length + (editingId ? 1 : 2)))
  }

  async function quickProgress(goal, nextProgress) {
    const progress = clampProgress(nextProgress)
    const status =
      progress === 100 ? 'complete' : goal.status === 'complete' ? 'active' : goal.status

    setGoals(prev =>
      prev.map(item =>
        item.id === goal.id
          ? { ...item, progress_pct: progress, status }
          : item,
      ),
    )

    const { error: updateError } = await supabase
      .from('goals')
      .update({
        progress_pct: progress,
        status,
      })
      .eq('id', goal.id)

    if (updateError) {
      setError('Could not update progress.')
      fetchGoals()
    }
  }

  async function deleteGoal(goal) {
    setError('')
    const previousGoals = goals
    setGoals(prev => prev.filter(item => item.id !== goal.id))

    const { error: deleteError } = await supabase.from('goals').delete().eq('id', goal.id)
    if (deleteError) {
      setGoals(previousGoals)
      setError('Could not delete goal.')
    }
  }

  return (
    <main className="max-w-[1200px] mx-auto px-6 py-8">
      <section className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-body font-semibold uppercase tracking-widest text-os-muted">
              Phase 3
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold text-os-fg">
              Goals
            </h1>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:min-w-[360px]">
            <Metric label="Active" value={activeGoals.length} />
            <Metric label="Done" value={completeCount} />
            <Metric label="Avg" value={`${averageProgress}%`} />
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-body text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-body font-semibold uppercase tracking-widest text-os-muted">
              Goal tracker
            </p>
            {loading && <span className="text-xs font-body text-os-muted">Loading</span>}
          </div>

          <div className="flex flex-col gap-3">
            {!loading && goals.length === 0 && (
              <div className="habit-card rounded-xl p-6 text-sm text-os-muted">
                No goals yet.
              </div>
            )}

            {goals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={() => startEdit(goal)}
                onDelete={() => deleteGoal(goal)}
                onProgress={nextProgress => quickProgress(goal, nextProgress)}
              />
            ))}
          </div>
        </section>

        <aside className="habit-card rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-body font-semibold uppercase tracking-widest text-os-muted">
                {editingId ? 'Edit goal' : 'New goal'}
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold text-os-fg">
                {editingId ? 'Update progress' : 'Create target'}
              </h2>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="action-pill-btn action-pill-indigo"
              >
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={saveGoal} className="flex flex-col gap-4">
            <Field label="Name">
              <input
                value={draft.name}
                onChange={event => updateDraft('name', event.target.value)}
                className="drawer-input w-full"
                placeholder="Research paper"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Icon">
                <select
                  value={draft.icon}
                  onChange={event => updateDraft('icon', event.target.value)}
                  className="drawer-input w-full"
                >
                  {GOAL_ICON_OPTIONS.map(icon => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Color">
                <select
                  value={draft.color}
                  onChange={event => updateDraft('color', event.target.value)}
                  className="drawer-input w-full"
                >
                  {GOAL_COLOR_OPTIONS.map(color => (
                    <option key={color.value} value={color.value}>
                      {color.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Progress">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={draft.progress_pct}
                  onChange={event => updateDraft('progress_pct', event.target.value)}
                  className="w-full accent-os-indigo"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={draft.progress_pct}
                  onChange={event => updateDraft('progress_pct', event.target.value)}
                  className="drawer-input w-20 text-right"
                />
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Target date">
                <input
                  type="date"
                  value={draft.target_date}
                  onChange={event => updateDraft('target_date', event.target.value)}
                  className="drawer-input w-full"
                />
              </Field>

              <Field label="Label">
                <input
                  value={draft.label}
                  onChange={event => updateDraft('label', event.target.value)}
                  className="drawer-input w-full"
                  placeholder="Nov 30"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select
                  value={draft.status}
                  onChange={event => updateDraft('status', event.target.value)}
                  className="drawer-input w-full"
                >
                  {STATUS_OPTIONS.map(status => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Order">
                <input
                  type="number"
                  min="1"
                  value={draft.sort_order}
                  onChange={event => updateDraft('sort_order', event.target.value)}
                  className="drawer-input w-full"
                />
              </Field>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="action-pill-btn action-pill-emerald justify-center"
            >
              <i className={`ti ti-${editingId ? 'device-floppy' : 'plus'}`} />
              {saving ? 'Saving' : editingId ? 'Save goal' : 'Create goal'}
            </button>
          </form>
        </aside>
      </div>
    </main>
  )
}

function Metric({ label, value }) {
  return (
    <div className="habit-card rounded-xl px-4 py-3">
      <p className="text-[11px] font-body font-semibold uppercase tracking-widest text-os-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl text-os-fg">{value}</p>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-body font-semibold uppercase tracking-widest text-os-muted">
        {label}
      </span>
      {children}
    </label>
  )
}

function GoalCard({ goal, onEdit, onDelete, onProgress }) {
  const progress = clampProgress(goal.progress_pct)
  const muted = goal.status !== 'active'

  return (
    <article className={`habit-card card-interactive rounded-xl p-4 ${muted ? 'opacity-70' : ''}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg"
            style={{ backgroundColor: `${goal.color}22`, color: goal.color }}
          >
            <i className={`ti ti-${goal.icon} text-xl`} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-lg font-semibold text-os-fg">
                {goal.name}
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-body font-semibold uppercase tracking-wide"
                style={{ backgroundColor: `${goal.color}22`, color: goal.color }}
              >
                {goal.status}
              </span>
            </div>
            <p className="mt-1 text-xs font-body text-os-muted">
              {goal.label || formatTargetDate(goal.target_date)}
            </p>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between text-xs font-body text-os-muted">
            <span>{formatTargetDate(goal.target_date)}</span>
            <span className="font-mono tabular-nums">{progress}%</span>
          </div>
          <div className="progress-track h-2 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                backgroundColor: goal.color,
                boxShadow: `0 0 8px ${goal.color}50`,
              }}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
          <ProgressButton icon="minus" label="Decrease progress" onClick={() => onProgress(progress - 5)} />
          <ProgressButton icon="plus" label="Increase progress" onClick={() => onProgress(progress + 5)} />
          <button type="button" onClick={onEdit} className="action-pill-btn action-pill-indigo">
            <i className="ti ti-pencil" />
            Edit
          </button>
          <button type="button" onClick={onDelete} className="action-pill-btn action-pill-red">
            <i className="ti ti-trash" />
            Delete
          </button>
        </div>
      </div>
    </article>
  )
}

function ProgressButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="action-pill-btn action-pill-indigo px-3"
      aria-label={label}
      title={label}
    >
      <i className={`ti ti-${icon}`} />
    </button>
  )
}
