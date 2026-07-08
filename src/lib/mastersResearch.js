import { supabase } from './supabase'

export const COUNTRY_RESEARCH_STEPS = [
  'Static country context collected',
  'Current country data collected',
  'Community sentiment collected',
  'Synthesizing report',
]

export const UNIVERSITY_RESEARCH_STEPS = [
  'Static university context collected',
  'Current admissions and financial data collected',
  'Community sentiment collected',
  'Synthesizing report',
]

const COUNTRY_REFRESH_STEPS = [
  'Current country data collected',
  'Synthesizing report',
]

const UNIVERSITY_REFRESH_STEPS = [
  'Current admissions and financial data collected',
  'Synthesizing report',
]

export function getResearchKey(entityType, id) {
  return `${entityType}:${id}`
}

export function getResearchSteps(entityType, mode = 'initial') {
  if (mode === 'refresh') {
    return entityType === 'country' ? COUNTRY_REFRESH_STEPS : UNIVERSITY_REFRESH_STEPS
  }
  return entityType === 'country' ? COUNTRY_RESEARCH_STEPS : UNIVERSITY_RESEARCH_STEPS
}

export async function runMastersResearch({ entityType, entityId, mode }) {
  const { data, error } = await supabase.functions.invoke('masters-research', {
    body: { entityType, entityId, mode },
  })

  if (error) {
    const response = error.context
    if (response?.json) {
      let edgeError = ''
      try {
        const payload = await response.clone().json()
        edgeError = payload?.error ?? ''
      } catch (_) {}
      if (edgeError) throw new Error(edgeError)
    }
    throw error
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export function splitStaticDynamic(entityType, report) {
  if (!report) return { staticResearch: null, dynamicResearch: null }

  if (entityType === 'country') {
    return {
      staticResearch: {
        student_experience: report.student_experience,
        pr_pathway: {
          route_name: report.pr_pathway?.route_name,
          typical_timeline_years: report.pr_pathway?.typical_timeline_years,
          success_rate_for_indians: report.pr_pathway?.success_rate_for_indians,
          key_requirements: report.pr_pathway?.key_requirements,
          honest_assessment: report.pr_pathway?.honest_assessment,
        },
        reddit_community_sentiment: report.reddit_community_sentiment,
        overall_settlement_verdict: report.overall_settlement_verdict,
      },
      dynamicResearch: {
        pr_pathway: {
          recent_policy_changes: report.pr_pathway?.recent_policy_changes,
        },
        cost_of_living: report.cost_of_living,
        job_market: report.job_market,
      },
    }
  }

  return {
    staticResearch: {
      overview: report.overview,
      cs_ai_department: report.cs_ai_department,
      student_experience: report.student_experience,
      honest_assessment: report.honest_assessment,
    },
    dynamicResearch: {
      admission: report.admission,
      financials: report.financials,
    },
  }
}

export function mergeResearch(entityType, entity) {
  const staticResearch = entity?.static_research ?? {}
  const dynamicResearch = entity?.dynamic_research ?? {}

  if (entityType === 'country') {
    return {
      student_experience: staticResearch.student_experience,
      pr_pathway: {
        ...(staticResearch.pr_pathway ?? {}),
        ...(dynamicResearch.pr_pathway ?? {}),
      },
      cost_of_living: dynamicResearch.cost_of_living,
      job_market: dynamicResearch.job_market,
      reddit_community_sentiment: staticResearch.reddit_community_sentiment,
      overall_settlement_verdict: staticResearch.overall_settlement_verdict,
      raw_results: staticResearch.raw_results ?? dynamicResearch.raw_results,
      synthesis_error: staticResearch.synthesis_error ?? dynamicResearch.synthesis_error,
    }
  }

  return {
    overview: staticResearch.overview,
    cs_ai_department: staticResearch.cs_ai_department,
    admission: dynamicResearch.admission,
    financials: dynamicResearch.financials,
    student_experience: staticResearch.student_experience,
    honest_assessment: staticResearch.honest_assessment,
    raw_results: staticResearch.raw_results ?? dynamicResearch.raw_results,
    synthesis_error: staticResearch.synthesis_error ?? dynamicResearch.synthesis_error,
  }
}

export function getCitationNumbers(text) {
  if (!text || typeof text !== 'string') return []
  return [...text.matchAll(/\[(\d+)\]/g)].map(match => Number(match[1]))
}

export function isDynamicStale(entity) {
  if (!entity?.dynamic_refreshed_at) return true
  const refreshed = new Date(entity.dynamic_refreshed_at)
  if (Number.isNaN(refreshed.getTime())) return true
  const diffDays = Math.floor((new Date() - refreshed) / 86400000)
  return diffDays > 180
}

export function formatResearchDate(dateString) {
  if (!dateString) return 'No date'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function asList(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  return [String(value)]
}

export function displayValue(value) {
  if (Array.isArray(value)) return value.join(', ')
  if (value === null || value === undefined || value === '') return 'No data found'
  return String(value)
}
