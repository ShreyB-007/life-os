import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  asList,
  displayValue,
  formatResearchDate,
  getCitationNumbers,
  isDynamicStale,
} from '../lib/mastersResearch'

export function ReportHero({
  title,
  subtitle,
  backTo,
  backLabel,
  entity,
  refreshing,
  onRefresh,
  children,
}) {
  return (
    <section className="habit-card rounded-xl p-5">
      <Link to={backTo} className="action-pill-btn action-pill-indigo mb-5">
        <i className="ti ti-arrow-left" />
        {backLabel}
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-os-fg">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-os-muted">{subtitle}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <ResearchBadge label={`Researched ${formatResearchDate(entity?.static_researched_at)}`} tone="green" />
            <ResearchBadge
              label={`Data current as of ${formatResearchDate(entity?.dynamic_refreshed_at)}`}
              tone={isDynamicStale(entity) ? 'amber' : 'green'}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="action-pill-btn action-pill-amber"
          >
            <i className={`ti ti-${refreshing ? 'loader-2 animate-spin' : 'refresh'}`} />
            {refreshing ? 'Refreshing...' : 'Refresh current data'}
          </button>
          {children}
        </div>
      </div>
    </section>
  )
}

export function TabBar({ tabs, activeTab, onTab }) {
  return (
    <div className="sticky top-[53px] z-20 -mx-2 overflow-x-auto px-2 py-3 backdrop-blur">
      <div className="flex gap-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTab(tab.key)}
            className={`rounded-lg px-3 py-2 text-sm font-body transition ${
              activeTab === tab.key ? 'bg-indigo-500/15 text-os-fg' : 'text-os-muted hover:bg-indigo-500/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ReportSection({ title, children, sources }) {
  return (
    <section className="habit-card rounded-xl p-5">
      <h2 className="font-display text-xl font-semibold text-os-fg">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-7 text-os-secondary">{children}</div>
      <SourcesList sources={sources} />
    </section>
  )
}

export function CitationText({ text, sourcesByIndex }) {
  const value = displayValue(text)
  const parts = value.split(/(\[[\d,\s-]+\])/g)
  return (
    <span>
      {parts.map((part, index) => {
        if (!part.match(/^\[[\d,\s-]+\]$/)) return <span key={`${part}-${index}`}>{part}</span>
        return <CitationGroup key={`${part}-${index}`} token={part} sourcesByIndex={sourcesByIndex} />
      })}
    </span>
  )
}

function CitationGroup({ token, sourcesByIndex }) {
  const content = token.slice(1, -1)
  const pieces = content.split(/(\d+\s*-\s*\d+|\d+)/g).filter(Boolean)

  return (
    <sup className="text-[11px] font-semibold text-os-indigo">
      [
      {pieces.map((piece, index) => {
        const range = piece.match(/^(\d+)\s*-\s*(\d+)$/)
        if (range) {
          const start = Number(range[1])
          const end = Number(range[2])
          return (
            <span key={`${piece}-${index}`}>
              <CitationLink number={start} source={sourcesByIndex.get(start)} />
              -
              <CitationLink number={end} source={sourcesByIndex.get(end)} />
            </span>
          )
        }

        if (/^\d+$/.test(piece)) {
          const number = Number(piece)
          return <CitationLink key={`${piece}-${index}`} number={number} source={sourcesByIndex.get(number)} />
        }

        return <span key={`${piece}-${index}`}>{piece}</span>
      })}
      ]
    </sup>
  )
}

function CitationLink({ number, source }) {
  if (!source) return <span>{number}</span>
  return (
    <a href={source.source_url} target="_blank" rel="noreferrer" className="text-os-indigo">
      {number}
    </a>
  )
}

export function KeyValueTable({ rows, sourcesByIndex }) {
  return (
    <div className="overflow-hidden rounded-lg" style={{ border: '1px solid var(--drawer-card-border)' }}>
      {rows.map(row => (
        <div
          key={row.label}
          className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[190px_minmax(0,1fr)]"
          style={{ borderBottom: '1px solid var(--drawer-card-border)' }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-os-muted">{row.label}</span>
          <span className="text-sm text-os-secondary">
            <CitationText text={row.value} sourcesByIndex={sourcesByIndex} />
          </span>
        </div>
      ))}
    </div>
  )
}

export function BulletList({ items, sourcesByIndex }) {
  const list = asList(items)
  if (list.length === 0) return <p>No data found</p>
  return (
    <ul className="space-y-2">
      {list.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-os-indigo" />
          <span><CitationText text={item} sourcesByIndex={sourcesByIndex} /></span>
        </li>
      ))}
    </ul>
  )
}

export function PersonalNotes({ entityType, entity, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(entity?.personal_notes ?? '')
  const table = entityType === 'country' ? 'countries' : 'universities'

  async function save() {
    setEditing(false)
    if (value === (entity?.personal_notes ?? '')) return

    const { data } = await supabase
      .from(table)
      .update({ personal_notes: value })
      .eq('id', entity.id)
      .select()
      .single()
    if (data) onSaved(data)
  }

  return (
    <section className="habit-card rounded-xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-os-fg">Your Notes</h2>
        <button type="button" onClick={() => setEditing(true)} className="text-os-muted hover:text-os-fg">
          <i className="ti ti-pencil" />
        </button>
      </div>
      {editing ? (
        <textarea
          value={value}
          onChange={event => setValue(event.target.value)}
          onBlur={save}
          autoFocus
          className="drawer-input min-h-[120px] w-full resize-y font-body"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-[90px] w-full text-left text-sm leading-6 text-os-secondary"
        >
          {value.trim() || 'Add your personal thoughts, conversations, and impressions...'}
        </button>
      )}
    </section>
  )
}

export function useSourcesByIndex(sources) {
  return useMemo(() => {
    const map = new Map()
    for (const source of sources ?? []) map.set(source.citation_index, source)
    return map
  }, [sources])
}

export function sectionSources(sources, values) {
  const wanted = new Set()
  for (const value of values.flat(Infinity)) {
    for (const number of getCitationNumbers(String(value ?? ''))) wanted.add(number)
  }
  return (sources ?? []).filter(source => wanted.has(source.citation_index))
}

function ResearchBadge({ label, tone }) {
  const color = tone === 'amber' ? '#F59E0B' : '#10B981'
  return (
    <span
      className="rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      {label}
    </span>
  )
}

function SourcesList({ sources }) {
  const [open, setOpen] = useState(false)
  if (!sources?.length) return null

  return (
    <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--drawer-card-border)' }}>
      <button type="button" onClick={() => setOpen(prev => !prev)} className="text-sm font-semibold text-os-indigo">
        Sources ({sources.length})
      </button>
      {open && (
        <ol className="mt-3 space-y-2 text-xs text-os-muted">
          {sources.map(source => (
            <li key={`${source.citation_index}-${source.source_url}`} className="flex gap-2">
              <span className="font-mono text-os-secondary">[{source.citation_index}]</span>
              <a href={source.source_url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-os-secondary hover:text-os-fg">
                {source.source_title}
              </a>
              <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 uppercase tracking-wide text-os-indigo">
                {source.source_type}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
