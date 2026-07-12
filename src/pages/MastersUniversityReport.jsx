import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  BulletList,
  KeyValueTable,
  PersonalNotes,
  ReportHero,
  ReportNotice,
  ReportSection,
  TabBar,
  sectionSources,
  useSourcesByIndex,
} from '../components/MastersReportComponents'
import { getMastersResearchErrorMessage, mergeResearch, runMastersResearch } from '../lib/mastersResearch'
import { supabase } from '../lib/supabase'

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'department', label: 'CS & AI Department' },
  { key: 'admission', label: 'Admission' },
  { key: 'financials', label: 'Financials' },
  { key: 'student', label: 'Student Life' },
  { key: 'verdict', label: 'Verdict' },
]

export default function MastersUniversityReport() {
  const { universityId } = useParams()
  const [university, setUniversity] = useState(null)
  const [sources, setSources] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')

  useEffect(() => {
    fetchReport()
  }, [universityId])

  async function fetchReport() {
    setLoading(true)
    const [universityRes, sourcesRes] = await Promise.all([
      supabase.from('universities').select('*, countries(*)').eq('id', universityId).maybeSingle(),
      supabase.from('research_sources').select('*').eq('entity_type', 'university').eq('entity_id', universityId).order('citation_index'),
    ])
    setUniversity(universityRes.data ?? null)
    setSources(sourcesRes.data ?? [])
    setLoading(false)
  }

  async function refreshDynamicData() {
    setRefreshing(true)
    setRefreshError('')

    try {
      const result = await runMastersResearch({ entityType: 'university', entityId: university.id, mode: 'refresh' })
      setUniversity({ ...result.entity, countries: university.countries })
      const { data } = await supabase
        .from('research_sources')
        .select('*')
        .eq('entity_type', 'university')
        .eq('entity_id', university.id)
        .order('citation_index')
      setSources(data ?? [])
    } catch (error) {
      setRefreshError(getMastersResearchErrorMessage(error))
    } finally {
      setRefreshing(false)
    }
  }

  const report = useMemo(() => mergeResearch('university', university), [university])
  const sourcesByIndex = useSourcesByIndex(sources)

  if (loading) return <ReportShell title="Loading report" subtitle="Fetching university details." />
  if (!university) return <ReportShell title="University not found" subtitle="Return to Masters and select another university." />
  if (!university.static_research) {
    return (
      <ReportShell
        title={university.name}
        subtitle="This university hasn't been researched yet. Return to Masters to start research."
        country={university.countries}
      />
    )
  }

  const country = university.countries
  return (
    <main className="max-w-[1100px] mx-auto px-6 py-8">
      <ReportHero
        title={university.name}
        subtitle={[university.city, country?.flag_emoji, country?.name].filter(Boolean).join(' - ')}
        backTo={`/masters/country/${country?.id}`}
        backLabel={country?.name ?? 'Country'}
        entity={university}
        refreshing={refreshing}
        onRefresh={refreshDynamicData}
      >
        <Link to="/masters" className="action-pill-btn action-pill-red">
          <i className="ti ti-trash" />
          Remove university
        </Link>
      </ReportHero>

      {refreshError && (
        <div className="mt-5">
          <ReportNotice tone="amber">{refreshError}</ReportNotice>
        </div>
      )}

      <TabBar tabs={tabs} activeTab={activeTab} onTab={setActiveTab} />
      <UniversityTab tab={activeTab} report={report} sources={sources} sourcesByIndex={sourcesByIndex} />

      <div className="mt-5">
        <PersonalNotes entityType="university" entity={university} onSaved={data => setUniversity({ ...data, countries: country })} />
      </div>
    </main>
  )
}

function UniversityTab({ tab, report, sources, sourcesByIndex }) {
  if (report.synthesis_error) {
    return <ReportSection title="Raw Research Saved" sources={[]}>{JSON.stringify(report.raw_results, null, 2)}</ReportSection>
  }

  if (tab === 'overview') {
    const data = report.overview ?? {}
    return (
      <ReportSection title="Overview" sources={sectionSources(sources, Object.values(data))}>
        <KeyValueTable
          sourcesByIndex={sourcesByIndex}
          rows={[
            { label: 'Founded', value: data.founded },
            { label: 'Location', value: data.location },
            { label: 'Overall QS ranking', value: data.overall_qs_ranking },
            { label: 'CS ranking', value: data.cs_specific_ranking },
            { label: 'Type', value: data.university_type },
            { label: 'Campus size', value: data.campus_size },
          ]}
        />
      </ReportSection>
    )
  }

  if (tab === 'department') {
    const data = report.cs_ai_department ?? {}
    return (
      <ReportSection title="CS & AI Department" sources={sectionSources(sources, [...Object.values(data), data.ai_ml_faculty_highlights, data.research_areas])}>
        <KeyValueTable
          sourcesByIndex={sourcesByIndex}
          rows={[
            { label: 'Reputation', value: data.department_reputation },
            { label: 'Industry connections', value: data.industry_connections },
            { label: 'Reddit consensus', value: data.reddit_consensus },
          ]}
        />
        <h3 className="font-display text-base font-semibold text-os-fg">Faculty highlights</h3>
        <BulletList items={data.ai_ml_faculty_highlights} sourcesByIndex={sourcesByIndex} />
        <h3 className="font-display text-base font-semibold text-os-fg">Research areas</h3>
        <BulletList items={data.research_areas} sourcesByIndex={sourcesByIndex} />
      </ReportSection>
    )
  }

  if (tab === 'admission') {
    const data = report.admission ?? {}
    return (
      <ReportSection title="Admission" sources={sectionSources(sources, Object.values(data))}>
        <KeyValueTable
          sourcesByIndex={sourcesByIndex}
          rows={[
            { label: 'Program', value: data.program_name },
            { label: 'Duration', value: data.duration_years },
            { label: 'Intake', value: data.intake },
            { label: 'GPA', value: data.gpa_requirement },
            { label: 'English', value: data.english_requirement },
            { label: 'GRE', value: data.gre_required },
            { label: 'Work experience', value: data.work_experience_expected },
            { label: 'Fall 2027 deadline', value: data.application_deadline_fall2027 },
            { label: 'Acceptance rate', value: data.acceptance_rate_estimate },
            { label: 'Intake size', value: data.intake_size_estimate },
          ]}
        />
      </ReportSection>
    )
  }

  if (tab === 'financials') {
    const data = report.financials ?? {}
    return (
      <ReportSection title="Financials" sources={sectionSources(sources, [...Object.values(data), data.scholarship_names])}>
        <KeyValueTable
          sourcesByIndex={sourcesByIndex}
          rows={[
            { label: 'Annual tuition', value: data.annual_tuition_usd },
            { label: 'Total program cost', value: data.total_program_cost_usd },
            { label: 'Scholarships', value: data.scholarships_available },
            { label: 'TA/RA', value: data.ta_ra_opportunities },
          ]}
        />
        <h3 className="font-display text-base font-semibold text-os-fg">Scholarship names</h3>
        <BulletList items={data.scholarship_names} sourcesByIndex={sourcesByIndex} />
      </ReportSection>
    )
  }

  if (tab === 'student') {
    const data = report.student_experience ?? {}
    return (
      <ReportSection title="Student Life" sources={sectionSources(sources, Object.values(data))}>
        <KeyValueTable
          sourcesByIndex={sourcesByIndex}
          rows={[
            { label: 'Indian community', value: data.indian_community_size },
            { label: 'Campus life', value: data.campus_life },
            { label: 'Housing', value: data.housing_options },
            { label: 'Reddit review', value: data.reddit_honest_review },
          ]}
        />
      </ReportSection>
    )
  }

  const data = report.honest_assessment ?? {}
  return (
    <ReportSection title="Verdict" sources={sectionSources(sources, [...Object.values(data), data.strengths, data.weaknesses])}>
      <h3 className="font-display text-base font-semibold text-os-fg">Strengths</h3>
      <BulletList items={data.strengths} sourcesByIndex={sourcesByIndex} />
      <h3 className="font-display text-base font-semibold text-os-fg">Weaknesses</h3>
      <BulletList items={data.weaknesses} sourcesByIndex={sourcesByIndex} />
      <KeyValueTable
        sourcesByIndex={sourcesByIndex}
        rows={[
          { label: 'AI/ML fit', value: data.fit_for_ai_ml_career },
          { label: 'Overall verdict', value: data.overall_verdict },
        ]}
      />
    </ReportSection>
  )
}

function ReportShell({ title, subtitle, country }) {
  return (
    <main className="max-w-[900px] mx-auto px-6 py-8">
      <div className="habit-card rounded-xl p-6">
        <Link to={country ? `/masters/country/${country.id}` : '/masters'} className="action-pill-btn action-pill-indigo mb-6">
          <i className="ti ti-arrow-left" />
          {country?.name ?? 'Masters'}
        </Link>
        <h1 className="font-display text-3xl font-semibold text-os-fg">{title}</h1>
        <p className="mt-3 text-sm font-body text-os-muted">{subtitle}</p>
      </div>
    </main>
  )
}
