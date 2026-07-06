import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  BulletList,
  CitationText,
  KeyValueTable,
  PersonalNotes,
  ReportHero,
  ReportSection,
  TabBar,
  sectionSources,
  useSourcesByIndex,
} from '../components/MastersReportComponents'
import { mergeResearch, runMastersResearch } from '../lib/mastersResearch'
import { getResearchStatus, getStatusColor, getStatusLabel } from '../lib/researchStatus'
import { supabase } from '../lib/supabase'

const tabs = [
  { key: 'student', label: 'Student Life' },
  { key: 'pr', label: 'PR & Settlement' },
  { key: 'cost', label: 'Cost of Living' },
  { key: 'jobs', label: 'Job Market' },
  { key: 'community', label: 'Community Verdict' },
]

export default function MastersCountryReport() {
  const { countryId } = useParams()
  const [country, setCountry] = useState(null)
  const [universities, setUniversities] = useState([])
  const [sources, setSources] = useState([])
  const [activeTab, setActiveTab] = useState('student')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchReport()
  }, [countryId])

  async function fetchReport() {
    setLoading(true)
    const [countryRes, universitiesRes, sourcesRes] = await Promise.all([
      supabase.from('countries').select('*').eq('id', countryId).maybeSingle(),
      supabase.from('universities').select('*').eq('country_id', countryId).order('added_at'),
      supabase.from('research_sources').select('*').eq('entity_type', 'country').eq('entity_id', countryId).order('citation_index'),
    ])
    setCountry(countryRes.data ?? null)
    setUniversities(universitiesRes.data ?? [])
    setSources(sourcesRes.data ?? [])
    setLoading(false)
  }

  async function refreshDynamicData() {
    setRefreshing(true)
    const result = await runMastersResearch({ entityType: 'country', entityId: country.id, mode: 'refresh' })
    setCountry(result.entity)
    const { data } = await supabase
      .from('research_sources')
      .select('*')
      .eq('entity_type', 'country')
      .eq('entity_id', country.id)
      .order('citation_index')
    setSources(data ?? [])
    setRefreshing(false)
  }

  const report = useMemo(() => mergeResearch('country', country), [country])
  const sourcesByIndex = useSourcesByIndex(sources)

  if (loading) return <ReportShell title="Loading report" subtitle="Fetching country details." />
  if (!country) return <ReportShell title="Country not found" subtitle="Return to Masters and select another country." />
  if (!country.static_research) {
    return (
      <ReportShell
        title={`${country.flag_emoji} ${country.name}`}
        subtitle="This country hasn't been researched yet. Return to Masters to start research."
      />
    )
  }

  return (
    <main className="max-w-[1100px] mx-auto px-6 py-8">
      <ReportHero
        title={`${country.flag_emoji} ${country.name}`}
        backTo="/masters"
        backLabel="Masters"
        entity={country}
        refreshing={refreshing}
        onRefresh={refreshDynamicData}
      >
        <Link to="/masters" className="action-pill-btn action-pill-emerald">
          <i className="ti ti-school" />
          Add university
        </Link>
      </ReportHero>

      <TabBar tabs={tabs} activeTab={activeTab} onTab={setActiveTab} />

      <CountryTab tab={activeTab} report={report} sources={sources} sourcesByIndex={sourcesByIndex} />

      <div className="mt-5 flex flex-col gap-5">
        <PersonalNotes entityType="country" entity={country} onSaved={setCountry} />
        <UniversitiesList universities={universities} />
      </div>
    </main>
  )
}

function CountryTab({ tab, report, sources, sourcesByIndex }) {
  if (report.synthesis_error) {
    return <ReportSection title="Raw Research Saved" sources={[]}>{JSON.stringify(report.raw_results, null, 2)}</ReportSection>
  }

  if (tab === 'student') {
    const data = report.student_experience ?? {}
    return (
      <ReportSection title="Student Life" sources={sectionSources(sources, Object.values(data))}>
        <KeyValueTable
          sourcesByIndex={sourcesByIndex}
          rows={[
            { label: 'Indian community', value: data.indian_community },
            { label: 'Cultural adjustment', value: data.cultural_adjustment },
            { label: 'Language barrier', value: data.language_barrier },
            { label: 'Safety', value: data.safety },
            { label: 'Social life', value: data.social_life },
          ]}
        />
      </ReportSection>
    )
  }

  if (tab === 'pr') {
    const data = report.pr_pathway ?? {}
    return (
      <ReportSection title="PR & Settlement" sources={sectionSources(sources, [...Object.values(data), data.key_requirements])}>
        <KeyValueTable
          sourcesByIndex={sourcesByIndex}
          rows={[
            { label: 'Route', value: data.route_name },
            { label: 'Timeline', value: data.typical_timeline_years },
            { label: 'Success rate', value: data.success_rate_for_indians },
            { label: 'Recent policy changes', value: data.recent_policy_changes },
            { label: 'Assessment', value: data.honest_assessment },
          ]}
        />
        <h3 className="font-display text-base font-semibold text-os-fg">Key requirements</h3>
        <BulletList items={data.key_requirements} sourcesByIndex={sourcesByIndex} />
      </ReportSection>
    )
  }

  if (tab === 'cost') {
    const data = report.cost_of_living ?? {}
    return (
      <ReportSection title="Cost of Living" sources={sectionSources(sources, Object.values(data))}>
        <KeyValueTable
          sourcesByIndex={sourcesByIndex}
          rows={[
            { label: 'Student budget', value: data.monthly_student_budget_usd },
            { label: 'Rent', value: data.rent_range_usd },
            { label: 'Groceries', value: data.groceries_monthly_usd },
            { label: 'Transport', value: data.transport_monthly_usd },
            { label: 'Source year', value: data.source_year },
          ]}
        />
      </ReportSection>
    )
  }

  if (tab === 'jobs') {
    const data = report.job_market ?? {}
    return (
      <ReportSection title="Job Market" sources={sectionSources(sources, [...Object.values(data), data.top_employers])}>
        <KeyValueTable
          sourcesByIndex={sourcesByIndex}
          rows={[
            { label: 'AI/ML demand', value: data.ai_ml_demand },
            { label: 'Average salary', value: data.average_salary_usd },
            { label: 'Assessment', value: data.job_market_honest_assessment },
          ]}
        />
        <h3 className="font-display text-base font-semibold text-os-fg">Top employers</h3>
        <BulletList items={data.top_employers} sourcesByIndex={sourcesByIndex} />
      </ReportSection>
    )
  }

  const data = report.reddit_community_sentiment ?? {}
  return (
    <ReportSection title="Community Verdict" sources={sectionSources(sources, [...Object.values(data), report.overall_settlement_verdict])}>
      <p><CitationText text={data.summary} sourcesByIndex={sourcesByIndex} /></p>
      <h3 className="font-display text-base font-semibold text-os-fg">Common positives</h3>
      <BulletList items={data.common_positives} sourcesByIndex={sourcesByIndex} />
      <h3 className="font-display text-base font-semibold text-os-fg">Common negatives</h3>
      <BulletList items={data.common_negatives} sourcesByIndex={sourcesByIndex} />
      <h3 className="font-display text-base font-semibold text-os-fg">Representative quotes</h3>
      <BulletList items={data.representative_quotes} sourcesByIndex={sourcesByIndex} />
      <div className="rounded-lg p-4" style={{ background: 'var(--drawer-card-bg)' }}>
        <CitationText text={report.overall_settlement_verdict} sourcesByIndex={sourcesByIndex} />
      </div>
    </ReportSection>
  )
}

function UniversitiesList({ universities }) {
  return (
    <section className="habit-card rounded-xl p-5">
      <h2 className="font-display text-lg font-semibold text-os-fg">Universities in this country</h2>
      <div className="mt-4 flex flex-col gap-2">
        {universities.length === 0 && <p className="text-sm text-os-muted">No universities added yet.</p>}
        {universities.map(university => {
          const status = getResearchStatus(university)
          return (
            <div key={university.id} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ border: '1px solid var(--drawer-card-border)' }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getStatusColor(status) }} />
              <span className="min-w-0 flex-1 truncate text-sm text-os-secondary">{university.name}</span>
              <span className="text-xs text-os-muted">{getStatusLabel(university)}</span>
              {status !== 'unresearched' ? (
                <Link to={`/masters/university/${university.id}`} className="text-sm text-os-indigo">Open Report</Link>
              ) : (
                <Link to="/masters" className="text-sm text-os-indigo">Research</Link>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ReportShell({ title, subtitle }) {
  return (
    <main className="max-w-[900px] mx-auto px-6 py-8">
      <div className="habit-card rounded-xl p-6">
        <Link to="/masters" className="action-pill-btn action-pill-indigo mb-6">
          <i className="ti ti-arrow-left" />
          Masters
        </Link>
        <h1 className="font-display text-3xl font-semibold text-os-fg">{title}</h1>
        <p className="mt-3 text-sm font-body text-os-muted">{subtitle}</p>
      </div>
    </main>
  )
}
