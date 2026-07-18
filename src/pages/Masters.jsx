import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { normalizeExerciseName } from '../lib/exercise'
import {
  getResearchStatus,
  getStatusColor,
  getStatusLabel,
  hasPersonalNotes,
} from '../lib/researchStatus'
import {
  getMastersResearchErrorMessage,
  getResearchKey,
  getResearchSteps,
  runMastersResearch,
} from '../lib/mastersResearch'

const EMPTY_COUNTRY = { name: '', flag_emoji: '' }
const EMPTY_UNIVERSITY = { name: '', city: '' }
const MASTERS_SETUP_HINT = 'Run the Phase 3b Masters setup/repair SQL in Supabase, then reload this page.'

function getSupabaseErrorMessage(action, error) {
  if (!error) return `${action}.`
  const detail = [error.message, error.details, error.hint].filter(Boolean).join(' ')
  return `${action}: ${detail || 'Unknown Supabase error.'}`
}

function splitResearchTree(rows = []) {
  const nextCountries = []
  const nextUniversities = []

  for (const row of rows) {
    const { universities: nestedUniversities = [], ...country } = row
    nextCountries.push(country)
    for (const university of nestedUniversities) {
      nextUniversities.push({ ...university, country_id: university.country_id ?? country.id })
    }
  }

  nextUniversities.sort((a, b) => new Date(a.added_at ?? 0) - new Date(b.added_at ?? 0))
  return { nextCountries, nextUniversities }
}

export default function Masters() {
  const navigate = useNavigate()
  const [countries, setCountries] = useState([])
  const [universities, setUniversities] = useState([])
  const [expandedIds, setExpandedIds] = useState(new Set())
  const [selected, setSelected] = useState(null)
  const [showMobileTree, setShowMobileTree] = useState(false)
  const [countryModalOpen, setCountryModalOpen] = useState(false)
  const [universityCountry, setUniversityCountry] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [countryDraft, setCountryDraft] = useState(EMPTY_COUNTRY)
  const [universityDraft, setUniversityDraft] = useState(EMPTY_UNIVERSITY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [researching, setResearching] = useState(null)
  const [error, setError] = useState('')
  // Bumped by every local write to countries/universities. fetchResearchTree()
  // replaces both arrays wholesale, so if it's still in flight when a write lands
  // (e.g. the initial mount fetch is slow and a user immediately adds a country),
  // its stale snapshot must not overwrite the newer state — same fix as Dashboard.jsx
  // and Goals.jsx for the identical race.
  const treeVersionRef = useRef(0)

  useEffect(() => {
    fetchResearchTree()
  }, [])

  async function fetchResearchTree() {
    setLoading(true)
    setError('')
    const version = ++treeVersionRef.current

    const countriesRes = await supabase
      .from('countries')
      .select('*, universities(*)')
      .order('added_at', { ascending: true })

    if (countriesRes.error) {
      setError(`${getSupabaseErrorMessage('Could not load Masters research data', countriesRes.error)} ${MASTERS_SETUP_HINT}`)
      setLoading(false)
      return
    }

    if (treeVersionRef.current === version) {
      const { nextCountries, nextUniversities } = splitResearchTree(countriesRes.data ?? [])
      setCountries(nextCountries)
      setUniversities(nextUniversities)
    }
    setLoading(false)
  }

  const universitiesByCountry = useMemo(() => {
    const grouped = new Map()
    for (const country of countries) grouped.set(country.id, [])
    for (const university of universities) {
      if (!grouped.has(university.country_id)) grouped.set(university.country_id, [])
      grouped.get(university.country_id).push(university)
    }
    return grouped
  }, [countries, universities])

  const selectedCountry =
    selected?.type === 'country'
      ? countries.find(country => country.id === selected.id)
      : selected?.type === 'university'
        ? countries.find(country => country.id === selected.countryId)
        : null

  const selectedUniversity =
    selected?.type === 'university'
      ? universities.find(university => university.id === selected.id)
      : null

  const notesIndex = useMemo(() => {
    const countryNotes = countries
      .filter(hasPersonalNotes)
      .map(country => ({
        id: country.id,
        type: 'Country',
        name: country.name,
        flag: country.flag_emoji,
        notes: country.personal_notes,
        onOpen: () => setSelected({ type: 'country', id: country.id }),
      }))

    const universityNotes = universities
      .filter(hasPersonalNotes)
      .map(university => {
        const country = countries.find(item => item.id === university.country_id)
        return {
          id: university.id,
          type: 'University',
          name: university.name,
          flag: country?.flag_emoji ?? '',
          notes: university.personal_notes,
          onOpen: () =>
            setSelected({
              type: 'university',
              id: university.id,
              countryId: university.country_id,
            }),
        }
      })

    return [...countryNotes, ...universityNotes]
  }, [countries, universities])

  const researchedCountries = countries.filter(country => country.static_researched_at).length
  const researchedUniversities = universities.filter(university => university.static_researched_at).length

  function toggleCountry(country) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(country.id)) next.delete(country.id)
      else next.add(country.id)
      return next
    })
    setSelected({ type: 'country', id: country.id })
    setShowMobileTree(false)
  }

  function selectUniversity(university) {
    setSelected({
      type: 'university',
      id: university.id,
      countryId: university.country_id,
    })
    setShowMobileTree(false)
  }

  function openAddUniversity(country) {
    setUniversityCountry(country)
    setUniversityDraft(EMPTY_UNIVERSITY)
    setError('')
  }

  async function addCountry(event) {
    event.preventDefault()
    const name = countryDraft.name.trim()
    const flag = countryDraft.flag_emoji.trim()
    if (!name || !flag) {
      setError('Country name and flag emoji are required.')
      return
    }

    setSaving(true)
    setError('')
    const { data, error: insertError } = await supabase
      .from('countries')
      .insert({ name, flag_emoji: flag })
      .select()
      .single()

    if (insertError) {
      setError(`${getSupabaseErrorMessage('Could not add country', insertError)} ${MASTERS_SETUP_HINT}`)
      setSaving(false)
      return
    }

    treeVersionRef.current += 1
    setCountries(prev => [...prev, data])
    setExpandedIds(prev => new Set([...prev, data.id]))
    setSelected({ type: 'country', id: data.id })
    setCountryDraft(EMPTY_COUNTRY)
    setCountryModalOpen(false)
    setSaving(false)
  }

  async function addUniversity(event) {
    event.preventDefault()
    if (!universityCountry) return

    const name = universityDraft.name.trim()
    if (!name) {
      setError('University name is required.')
      return
    }

    const duplicate = (universitiesByCountry.get(universityCountry.id) ?? []).some(
      university => normalizeExerciseName(university.name) === normalizeExerciseName(name),
    )

    if (duplicate) {
      setError(`This university is already added under ${universityCountry.name}.`)
      return
    }

    setSaving(true)
    setError('')
    const { data, error: insertError } = await supabase
      .from('universities')
      .insert({
        country_id: universityCountry.id,
        name,
        city: universityDraft.city.trim() || null,
      })
      .select()
      .single()

    if (insertError) {
      setError(`${getSupabaseErrorMessage('Could not add university', insertError)} ${MASTERS_SETUP_HINT}`)
      setSaving(false)
      return
    }

    treeVersionRef.current += 1
    setUniversities(prev => [...prev, data])
    setExpandedIds(prev => new Set([...prev, universityCountry.id]))
    setSelected({ type: 'university', id: data.id, countryId: universityCountry.id })
    setUniversityCountry(null)
    setUniversityDraft(EMPTY_UNIVERSITY)
    setSaving(false)
  }

  function requestRemoveCountry(country) {
    const count = universitiesByCountry.get(country.id)?.length ?? 0
    setConfirmTarget({
      type: 'country',
      entity: country,
      title: `Remove ${country.name}?`,
      body: `This will also remove ${count} universities and all their research data. This cannot be undone.`,
      confirmText: 'Remove country',
    })
  }

  function requestRemoveUniversity(university) {
    setConfirmTarget({
      type: 'university',
      entity: university,
      title: `Remove ${university.name}?`,
      body: `All research and notes for this university will be deleted.`,
      confirmText: 'Remove university',
    })
  }

  async function confirmRemove() {
    if (!confirmTarget) return
    setSaving(true)
    setError('')

    if (confirmTarget.type === 'country') {
      const country = confirmTarget.entity
      const universityIds = (universitiesByCountry.get(country.id) ?? []).map(university => university.id)

      await supabase.from('research_sources').delete().eq('entity_type', 'country').eq('entity_id', country.id)
      if (universityIds.length > 0) {
        await supabase
          .from('research_sources')
          .delete()
          .eq('entity_type', 'university')
          .in('entity_id', universityIds)
      }

      const { error: deleteError } = await supabase.from('countries').delete().eq('id', country.id)
      if (deleteError) {
        setError(getSupabaseErrorMessage('Could not remove country', deleteError))
        setSaving(false)
        return
      }

      treeVersionRef.current += 1
      setCountries(prev => prev.filter(item => item.id !== country.id))
      setUniversities(prev => prev.filter(item => item.country_id !== country.id))
      setSelected(null)
      setExpandedIds(prev => {
        const next = new Set(prev)
        next.delete(country.id)
        return next
      })
    } else {
      const university = confirmTarget.entity
      await supabase
        .from('research_sources')
        .delete()
        .eq('entity_type', 'university')
        .eq('entity_id', university.id)

      const { error: deleteError } = await supabase.from('universities').delete().eq('id', university.id)
      if (deleteError) {
        setError(getSupabaseErrorMessage('Could not remove university', deleteError))
        setSaving(false)
        return
      }

      treeVersionRef.current += 1
      setUniversities(prev => prev.filter(item => item.id !== university.id))
      setSelected({ type: 'country', id: university.country_id })
    }

    setConfirmTarget(null)
    setSaving(false)
  }

  async function handleResearch(entityType, entity, mode = 'initial') {
    const key = getResearchKey(entityType, entity.id)
    const steps = getResearchSteps(entityType, mode)
    setResearching({ key, entityType, label: entity.name, mode, steps, activeStep: 0 })
    setError('')

    let interval = null
    try {
      interval = window.setInterval(() => {
        setResearching(prev => {
          if (!prev || prev.key !== key) return prev
          return {
            ...prev,
            activeStep: Math.min(prev.activeStep + 1, prev.steps.length - 1),
          }
        })
      }, 1800)

      const result = await runMastersResearch({
        entityType,
        entityId: entity.id,
        mode,
      })

      setResearching(prev =>
        prev && prev.key === key ? { ...prev, activeStep: prev.steps.length } : prev,
      )

      treeVersionRef.current += 1
      if (entityType === 'country') {
        setCountries(prev => prev.map(item => (item.id === entity.id ? result.entity : item)))
        setSelected({ type: 'country', id: entity.id })
      } else {
        setUniversities(prev => prev.map(item => (item.id === entity.id ? result.entity : item)))
        setSelected({ type: 'university', id: entity.id, countryId: entity.country_id })
      }
    } catch (researchError) {
      setError(getMastersResearchErrorMessage(researchError))
    } finally {
      if (interval) window.clearInterval(interval)
      window.setTimeout(() => {
        setResearching(prev => (prev && prev.key === key ? null : prev))
      }, 700)
    }
  }

  return (
    <main className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="mb-4 flex items-center justify-between md:hidden">
        <button
          type="button"
          onClick={() => setShowMobileTree(true)}
          className="action-pill-btn action-pill-indigo"
        >
          <i className="ti ti-menu-2" />
          Open tree
        </button>
        {loading && <span className="text-xs text-os-muted">Loading</span>}
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-body text-red-300">
          {error}
        </div>
      )}

      <div className="flex gap-5">
        <div className="hidden md:block w-[280px] shrink-0">
          <MastersTree
            countries={countries}
            universitiesByCountry={universitiesByCountry}
            expandedIds={expandedIds}
            selected={selected}
            researchingKey={researching?.key}
            loading={loading}
            onAddCountry={() => {
              setCountryDraft(EMPTY_COUNTRY)
              setCountryModalOpen(true)
            }}
            onToggleCountry={toggleCountry}
            onSelectUniversity={selectUniversity}
            onAddUniversity={openAddUniversity}
          />
        </div>

        <section className="min-w-0 flex-1">
          {!selected && (
            <NotesIndex
              notes={notesIndex}
              researchedCountries={researchedCountries}
              totalCountries={countries.length}
              researchedUniversities={researchedUniversities}
              totalUniversities={universities.length}
            />
          )}

          {selected?.type === 'country' && selectedCountry && (
            <CountryPanel
              country={selectedCountry}
              universities={universitiesByCountry.get(selectedCountry.id) ?? []}
              researchState={researching?.key === getResearchKey('country', selectedCountry.id) ? researching : null}
              onAddUniversity={() => openAddUniversity(selectedCountry)}
              onRemove={() => requestRemoveCountry(selectedCountry)}
              onSelectUniversity={selectUniversity}
              onOpenReport={() => navigate(`/masters/country/${selectedCountry.id}`)}
              onResearch={() => handleResearch('country', selectedCountry, 'initial')}
              onRefresh={() => handleResearch('country', selectedCountry, 'refresh')}
            />
          )}

          {selected?.type === 'university' && selectedUniversity && selectedCountry && (
            <UniversityPanel
              university={selectedUniversity}
              country={selectedCountry}
              researchState={researching?.key === getResearchKey('university', selectedUniversity.id) ? researching : null}
              onRemove={() => requestRemoveUniversity(selectedUniversity)}
              onOpenReport={() => navigate(`/masters/university/${selectedUniversity.id}`)}
              onResearch={() => handleResearch('university', selectedUniversity, 'initial')}
              onRefresh={() => handleResearch('university', selectedUniversity, 'refresh')}
            />
          )}
        </section>
      </div>

      {showMobileTree && (
        <div className="fixed inset-0 md:hidden" style={{ zIndex: 250 }}>
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowMobileTree(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[300px] max-w-[86vw] p-4">
            <MastersTree
              countries={countries}
              universitiesByCountry={universitiesByCountry}
              expandedIds={expandedIds}
              selected={selected}
              researchingKey={researching?.key}
              loading={loading}
              onAddCountry={() => {
                setCountryDraft(EMPTY_COUNTRY)
                setCountryModalOpen(true)
              }}
              onToggleCountry={toggleCountry}
              onSelectUniversity={selectUniversity}
              onAddUniversity={openAddUniversity}
            />
          </div>
        </div>
      )}

      {countryModalOpen && (
        <CountryModal
          draft={countryDraft}
          saving={saving}
          onChange={setCountryDraft}
          onSubmit={addCountry}
          onClose={() => setCountryModalOpen(false)}
        />
      )}

      {universityCountry && (
        <UniversityModal
          country={universityCountry}
          draft={universityDraft}
          saving={saving}
          onChange={setUniversityDraft}
          onSubmit={addUniversity}
          onClose={() => setUniversityCountry(null)}
        />
      )}

      {confirmTarget && (
        <ConfirmModal
          target={confirmTarget}
          saving={saving}
          onConfirm={confirmRemove}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </main>
  )
}

function MastersTree({
  countries,
  universitiesByCountry,
  expandedIds,
  selected,
  researchingKey,
  loading,
  onAddCountry,
  onToggleCountry,
  onSelectUniversity,
  onAddUniversity,
}) {
  return (
    <aside
      className="sticky top-[72px] flex max-h-[calc(100vh-96px)] flex-col rounded-xl"
      style={{
        background: 'var(--drawer-bg)',
        border: '1px solid var(--drawer-card-border)',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--drawer-card-border)' }}>
        <h1 className="font-display text-base font-semibold text-os-fg">Masters</h1>
        <button type="button" onClick={onAddCountry} className="action-pill-btn action-pill-indigo !min-h-0 px-3 py-1.5 text-xs">
          <i className="ti ti-plus" />
          Country
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {loading && <p className="px-2 text-xs text-os-muted">Loading research tree</p>}
        {!loading && countries.length === 0 && (
          <p className="px-2 text-xs text-os-muted">
            No countries yet. If you expected the seeded list, run the Phase 3b Masters setup SQL.
          </p>
        )}

        {countries.map(country => {
          const expanded = expandedIds.has(country.id)
          const universities = universitiesByCountry.get(country.id) ?? []
          const isSelected = selected?.type === 'country' && selected.id === country.id
          const countryResearching = researchingKey === getResearchKey('country', country.id)

          return (
            <div key={country.id} className="mb-1">
              <button
                type="button"
                onClick={() => onToggleCountry(country)}
                className={`masters-tree-row w-full ${isSelected ? 'is-selected' : ''}`}
              >
                <StatusDot entity={country} size={10} pulsing={countryResearching} />
                <span className="text-lg leading-none">{country.flag_emoji}</span>
                <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-os-secondary">
                  {country.name}
                </span>
                {hasPersonalNotes(country) && <i className="ti ti-star-filled text-[10px] text-os-indigo" />}
                {countryResearching && <i className="ti ti-loader-2 animate-spin text-xs text-os-indigo" />}
                <i className={`ti ti-chevron-${expanded ? 'down' : 'right'} text-xs text-os-muted`} />
              </button>

              {expanded && (
                <div className="ml-[18px] mt-1 border-l pl-2" style={{ borderColor: 'var(--drawer-card-border)' }}>
                  {universities.map(university => {
                    const uniSelected = selected?.type === 'university' && selected.id === university.id
                    const unresearched = getResearchStatus(university) === 'unresearched'
                    const universityResearching = researchingKey === getResearchKey('university', university.id)
                    return (
                      <button
                        type="button"
                        key={university.id}
                        onClick={() => onSelectUniversity(university)}
                        className={`masters-tree-row w-full py-1.5 ${uniSelected ? 'is-selected' : ''}`}
                      >
                        <StatusDot entity={university} size={8} pulsing={universityResearching} />
                        <span
                          className={`min-w-0 flex-1 truncate text-left text-xs ${
                            unresearched ? 'text-os-muted' : 'text-os-secondary'
                          }`}
                        >
                          {university.name}
                        </span>
                        {hasPersonalNotes(university) && <i className="ti ti-star-filled text-[10px] text-os-indigo" />}
                        {universityResearching && <i className="ti ti-loader-2 animate-spin text-xs text-os-indigo" />}
                      </button>
                    )
                  })}

                  <button
                    type="button"
                    onClick={() => onAddUniversity(country)}
                    className="masters-tree-row w-full py-1.5 text-xs text-os-muted"
                  >
                    <i className="ti ti-plus text-xs" />
                    <span> Add university here</span>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="m-3 rounded-lg p-3 text-[11px] text-os-muted" style={{ background: 'var(--drawer-card-bg)', border: '1px solid var(--drawer-card-border)' }}>
        <LegendRow color="#4A4A60" label="Not researched" />
        <LegendRow color="#F59E0B" label="Data stale (>6 months)" />
        <LegendRow color="#10B981" label="Up to date" />
        <div className="mt-2 flex items-center gap-2">
          <i className="ti ti-star-filled text-os-indigo" />
          <span>Has personal notes</span>
        </div>
      </div>
    </aside>
  )
}

function NotesIndex({ notes, researchedCountries, totalCountries, researchedUniversities, totalUniversities }) {
  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-semibold text-os-fg">Your Notes</h1>
        <p className="mt-1 text-sm text-os-muted">All reports where you've added personal notes</p>
      </div>

      <div className="mb-6 flex flex-col gap-3">
        {notes.length > 0 ? (
          notes.map(note => (
            <button
              key={`${note.type}-${note.id}`}
              type="button"
              onClick={note.onOpen}
              className="habit-card card-interactive rounded-xl p-4 text-left"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{note.flag}</span>
                    <span className="truncate font-display text-base font-semibold text-os-fg">
                      {note.name}
                    </span>
                    <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-os-indigo">
                      {note.type}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-os-muted">
                    {note.notes.length > 80 ? `${note.notes.slice(0, 80)}...` : note.notes}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-os-indigo">Open report -&gt;</span>
              </div>
            </button>
          ))
        ) : (
          <div className="habit-card rounded-xl p-5 text-sm text-os-muted">
            No notes yet. Open a country or university report and add your thoughts.
          </div>
        )}
      </div>

      <div className="habit-card rounded-xl p-5">
        <h2 className="font-display text-xl font-semibold text-os-fg">Research completion</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SummaryMetric label="Countries researched" value={`${researchedCountries} of ${totalCountries}`} />
          <SummaryMetric label="Universities researched" value={`${researchedUniversities} of ${totalUniversities}`} />
        </div>
      </div>
    </div>
  )
}

function CountryPanel({
  country,
  universities,
  researchState,
  onAddUniversity,
  onRemove,
  onSelectUniversity,
  onOpenReport,
  onResearch,
  onRefresh,
}) {
  const status = getResearchStatus(country)
  const researched = status !== 'unresearched'
  const running = Boolean(researchState)

  return (
    <div className="flex flex-col gap-5">
      <EntityHeader flag={country.flag_emoji} title={country.name} entity={country} />
      <div className="flex flex-wrap gap-2">
        {researched ? (
          <>
            <button type="button" onClick={onOpenReport} className="action-pill-btn action-pill-indigo">
              <i className="ti ti-file-text" />
              Open Report
            </button>
            <button type="button" onClick={onRefresh} disabled={running} className="action-pill-btn action-pill-amber">
              <i className={`ti ti-${running ? 'loader-2 animate-spin' : 'refresh'}`} />
              {running ? `Refreshing ${country.name}...` : 'Refresh current data'}
            </button>
          </>
        ) : (
          <button type="button" onClick={onResearch} disabled={running} className="action-pill-btn action-pill-indigo">
            <i className={`ti ti-${running ? 'loader-2 animate-spin' : 'search'}`} />
            {running ? `Researching ${country.name}...` : 'Research this country'}
          </button>
        )}
        <button type="button" onClick={onAddUniversity} className="action-pill-btn action-pill-emerald">
          <i className="ti ti-school" />
          Add university
        </button>
        <button type="button" onClick={onRemove} className="action-pill-btn action-pill-red">
          <i className="ti ti-trash" />
          Remove country
        </button>
      </div>

      {researchState && <ResearchProgress state={researchState} />}

      <div>
        <p className="mb-3 text-[11px] font-body font-semibold uppercase tracking-widest text-os-muted">
          Universities
        </p>
        <div className="flex flex-col gap-2">
          {universities.length > 0 ? (
            universities.map(university => (
              <button
                key={university.id}
                type="button"
                onClick={() => onSelectUniversity(university)}
                className="habit-card card-interactive rounded-xl p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <StatusDot entity={university} size={10} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-semibold text-os-fg">
                      {university.name}
                    </p>
                    <p className="text-xs text-os-muted">
                      {university.city || 'City not set'} · {getStatusLabel(university)}
                    </p>
                  </div>
                  {hasPersonalNotes(university) && <i className="ti ti-star-filled text-os-indigo" />}
                </div>
              </button>
            ))
          ) : (
            <div className="habit-card rounded-xl p-5 text-sm text-os-muted">
              No universities added for this country yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function UniversityPanel({ university, country, researchState, onRemove, onOpenReport, onResearch, onRefresh }) {
  const status = getResearchStatus(university)
  const researched = status !== 'unresearched'
  const running = Boolean(researchState)

  return (
    <div className="flex flex-col gap-5">
      <EntityHeader
        flag={country.flag_emoji}
        title={university.name}
        subtitle={[university.city, country.name].filter(Boolean).join(' · ')}
        entity={university}
      />
      <div className="flex flex-wrap gap-2">
        {researched ? (
          <>
            <button type="button" onClick={onOpenReport} className="action-pill-btn action-pill-indigo">
              <i className="ti ti-file-text" />
              Open Report
            </button>
            <button type="button" onClick={onRefresh} disabled={running} className="action-pill-btn action-pill-amber">
              <i className={`ti ti-${running ? 'loader-2 animate-spin' : 'refresh'}`} />
              {running ? `Refreshing ${university.name}...` : 'Refresh current data'}
            </button>
          </>
        ) : (
          <button type="button" onClick={onResearch} disabled={running} className="action-pill-btn action-pill-indigo">
            <i className={`ti ti-${running ? 'loader-2 animate-spin' : 'search'}`} />
            {running ? `Researching ${university.name}...` : 'Research this university'}
          </button>
        )}
        <button type="button" onClick={onRemove} className="action-pill-btn action-pill-red">
          <i className="ti ti-trash" />
          Remove university
        </button>
      </div>
      {researchState && <ResearchProgress state={researchState} />}
    </div>
  )
}

function EntityHeader({ flag, title, subtitle, entity }) {
  const status = getResearchStatus(entity)
  return (
    <div className="habit-card rounded-xl p-5">
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none">{flag}</span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-os-fg">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-os-muted">{subtitle}</p>}
          <div className="mt-3 flex items-center gap-2 text-sm">
            <StatusDot entity={entity} size={10} />
            <span style={{ color: getStatusColor(status) }}>{getStatusLabel(entity)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResearchProgress({ state }) {
  return (
    <div className="habit-card rounded-xl p-5">
      <div className="mb-4 flex items-center gap-3">
        <i className="ti ti-loader-2 animate-spin text-os-indigo" />
        <div>
          <h2 className="font-display text-xl font-semibold text-os-fg">
            {state.mode === 'refresh' ? `Refreshing ${state.label}...` : `Researching ${state.label}...`}
          </h2>
          <p className="text-xs text-os-muted">This can take a few minutes because web searches run sequentially.</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {state.steps.map((step, index) => {
          const done = index < state.activeStep
          const active = index === state.activeStep
          return (
            <div key={step} className="flex items-center gap-2 text-sm">
              {done && <i className="ti ti-check text-emerald-400" />}
              {active && <i className="ti ti-loader-2 animate-spin text-os-indigo" />}
              {!done && !active && <span className="h-4 w-4 rounded-full border border-os-muted/40" />}
              <span className={done || active ? 'text-os-secondary' : 'text-os-muted'}>{step}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CountryModal({ draft, saving, onChange, onSubmit, onClose }) {
  return (
    <BaseModal title="Add country" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <ModalField label="Country name">
          <input
            value={draft.name}
            onChange={event => onChange({ ...draft, name: event.target.value })}
            className="drawer-input w-full"
            placeholder="France"
          />
        </ModalField>
        <ModalField label="Flag emoji">
          <input
            value={draft.flag_emoji}
            onChange={event => onChange({ ...draft, flag_emoji: event.target.value })}
            className="drawer-input w-full"
            placeholder="🇫🇷"
          />
        </ModalField>
        <button type="submit" disabled={saving} className="action-pill-btn action-pill-emerald justify-center">
          <i className="ti ti-plus" />
          Add country
        </button>
      </form>
    </BaseModal>
  )
}

function UniversityModal({ country, draft, saving, onChange, onSubmit, onClose }) {
  return (
    <BaseModal title={`Add university in ${country.name}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <ModalField label="University name">
          <input
            value={draft.name}
            onChange={event => onChange({ ...draft, name: event.target.value })}
            className="drawer-input w-full"
            placeholder="University of Oxford"
          />
        </ModalField>
        <ModalField label="City">
          <input
            value={draft.city}
            onChange={event => onChange({ ...draft, city: event.target.value })}
            className="drawer-input w-full"
            placeholder="Oxford"
          />
        </ModalField>
        <button type="submit" disabled={saving} className="action-pill-btn action-pill-emerald justify-center">
          <i className="ti ti-school" />
          Add university
        </button>
      </form>
    </BaseModal>
  )
}

function ConfirmModal({ target, saving, onConfirm, onCancel }) {
  return (
    <BaseModal title={target.title} onClose={onCancel}>
      <p className="mb-5 text-sm text-os-muted">{target.body}</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="action-pill-btn action-pill-indigo">
          Cancel
        </button>
        <button type="button" onClick={onConfirm} disabled={saving} className="action-pill-btn action-pill-red">
          <i className="ti ti-trash" />
          {target.confirmText}
        </button>
      </div>
    </BaseModal>
  )
}

function BaseModal({ title, children, onClose }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ zIndex: 300 }} onClick={onClose} />
      <div
        className="fixed left-1/2 top-1/2 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl p-5 shadow-2xl"
        style={{ zIndex: 301, background: 'var(--drawer-bg)', border: '1px solid var(--drawer-card-border)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-os-fg">{title}</h2>
          <button type="button" onClick={onClose} className="text-os-muted hover:text-os-fg">
            <i className="ti ti-x text-xl" />
          </button>
        </div>
        {children}
      </div>
    </>
  )
}

function ModalField({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-body font-semibold uppercase tracking-widest text-os-muted">
        {label}
      </span>
      {children}
    </label>
  )
}

function StatusDot({ entity, size, pulsing }) {
  return (
    <span
      className={`shrink-0 rounded-full ${pulsing ? 'animate-pulse' : ''}`}
      style={{
        width: size,
        height: size,
        backgroundColor: getStatusColor(getResearchStatus(entity)),
      }}
    />
  )
}

function LegendRow({ color, label }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  )
}

function SummaryMetric({ label, value }) {
  return (
    <div className="rounded-lg p-4" style={{ background: 'var(--drawer-card-bg)', border: '1px solid var(--drawer-card-border)' }}>
      <p className="text-[11px] font-body font-semibold uppercase tracking-widest text-os-muted">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl text-os-fg">{value}</p>
    </div>
  )
}
