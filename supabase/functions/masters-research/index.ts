import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.107.0'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_MODEL = 'gemini-2.5-flash'

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { entityType, entityId, mode = 'initial' } = await req.json()
    if (!['country', 'university'].includes(entityType)) {
      throw new Error('Invalid entityType')
    }
    if (!['initial', 'refresh'].includes(mode)) {
      throw new Error('Invalid research mode')
    }
    if (!isUuid(entityId)) {
      throw new Error('Invalid entityId')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const context = await loadEntityContext(supabase, entityType, entityId)
    const searchResults = await collectSearchResults(entityType, context, mode)
    const sources = buildSources(entityType, entityId, searchResults)
    const report = await synthesizeReport(entityType, context, searchResults)
    const saved = await saveResearch(supabase, entityType, entityId, mode, report, searchResults, sources)

    return jsonResponse({ entity: saved, sources, report })
  } catch (error) {
    return jsonResponse({ error: error.message ?? 'Research failed' }, 500)
  }
})

async function loadEntityContext(supabase, entityType, entityId) {
  if (entityType === 'country') {
    const { data, error } = await supabase.from('countries').select('*').eq('id', entityId).single()
    if (error) throw new Error('Country not found')
    return { country: data }
  }

  const { data, error } = await supabase
    .from('universities')
    .select('*, countries(*)')
    .eq('id', entityId)
    .single()
  if (error) throw new Error('University not found')
  return { university: data, country: data.countries }
}

function isUuid(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

async function collectSearchResults(entityType, context, mode) {
  const prompts = entityType === 'country'
    ? buildCountryResearchPrompts(context.country, mode)
    : buildUniversityResearchPrompts(context.university, context.country, mode)

  const results = await Promise.all(prompts.map(async (researchPrompt, index) => {
    try {
      const grounded = await LLMService.generateGroundedContent(researchPrompt.prompt)
      return { ...researchPrompt, citationIndex: index + 1, ok: true, ...grounded }
    } catch (error) {
      return {
        ...researchPrompt,
        citationIndex: index + 1,
        ok: false,
        text: 'Data unavailable - search failed',
        error: error.message ?? 'Search failed',
        citations: [],
      }
    }
  }))
  if (results.every(result => !result.ok) && results.some(result => isQuotaError(result.error))) {
    throw new Error('Gemini quota exceeded. Research was not saved; retry after quota resets or billing is enabled.')
  }
  if (results.every(result => !result.ok)) {
    throw new Error('All Gemini research prompts failed. Research was not saved; retry later.')
  }
  assignCitationIndexes(results)
  return results
}

async function synthesizeReport(entityType, context, searchResults) {
  const prompt = entityType === 'country'
    ? buildCountrySynthesisPrompt(context.country, searchResults)
    : buildUniversitySynthesisPrompt(context.university, context.country, searchResults)

  try {
    const response = await LLMService.generateContent(prompt)
    return extractJson(response.text)
  } catch (error) {
    if (isQuotaError(error.message)) {
      throw new Error('Gemini quota exceeded during synthesis. Research was not saved; retry after quota resets or billing is enabled.')
    }
    return {
      synthesis_error: true,
      raw_results: searchResults,
      error_message: error.message ?? 'Report synthesis failed',
    }
  }
}

function isQuotaError(message) {
  return String(message ?? '').includes('[429 Too Many Requests]') ||
    String(message ?? '').toLowerCase().includes('quota exceeded')
}

async function saveResearch(supabase, entityType, entityId, mode, report, searchResults, sources) {
  const now = new Date().toISOString()
  const table = entityType === 'country' ? 'countries' : 'universities'
  const sourcePlan = mode === 'refresh'
    ? await buildRefreshSourcePlan(supabase, table, entityType, entityId, report, searchResults, sources)
    : { report, searchResults, sources }
  const payload = buildResearchPayload(entityType, mode, sourcePlan.report, sourcePlan.searchResults, now)

  await supabase.from('research_sources').delete().eq('entity_type', entityType).eq('entity_id', entityId)
  if (sourcePlan.sources.length > 0) {
    const { error: sourceError } = await supabase.from('research_sources').insert(sourcePlan.sources)
    if (sourceError) throw sourceError
  }

  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq('id', entityId)
    .select()
    .single()

  if (error) throw error
  return data
}

async function buildRefreshSourcePlan(supabase, table, entityType, entityId, report, searchResults, sources) {
  const { data: current, error: currentError } = await supabase
    .from(table)
    .select('static_research')
    .eq('id', entityId)
    .single()
  if (currentError) throw currentError

  const staticCitationIndexes = getCitationIndexesFromJson(current.static_research)
  const { data: existingSources, error: sourceError } = await supabase
    .from('research_sources')
    .select('citation_index, source_url, source_title, source_type')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
  if (sourceError) throw sourceError

  const preservedSources = (existingSources ?? [])
    .filter(source => staticCitationIndexes.has(source.citation_index))
    .map(source => ({
      entity_type: entityType,
      entity_id: entityId,
      citation_index: source.citation_index,
      source_url: source.source_url,
      source_title: source.source_title,
      source_type: source.source_type,
    }))
  const offset = Math.max(0, ...staticCitationIndexes, ...preservedSources.map(source => source.citation_index))
  const shiftedSources = sources.map(source => ({
    ...source,
    citation_index: source.citation_index + offset,
  }))

  return {
    report: shiftCitationReferences(report, offset),
    searchResults: shiftSearchResultCitations(searchResults, offset),
    sources: [...preservedSources, ...shiftedSources],
  }
}

function buildResearchPayload(entityType, mode, report, searchResults, now) {
  if (report.synthesis_error) {
    const rawPayload = { raw_results: searchResults, synthesis_error: true, error_message: report.error_message }
    return mode === 'refresh'
      ? { dynamic_research: rawPayload, dynamic_refreshed_at: now }
      : {
          static_research: rawPayload,
          dynamic_research: rawPayload,
          static_researched_at: now,
          dynamic_refreshed_at: now,
        }
  }

  if (entityType === 'country') {
    const staticResearch = {
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
    }
    const dynamicResearch = {
      pr_pathway: { recent_policy_changes: report.pr_pathway?.recent_policy_changes },
      cost_of_living: report.cost_of_living,
      job_market: report.job_market,
    }
    return mode === 'refresh'
      ? { dynamic_research: dynamicResearch, dynamic_refreshed_at: now }
      : {
          static_research: staticResearch,
          dynamic_research: dynamicResearch,
          static_researched_at: now,
          dynamic_refreshed_at: now,
        }
  }

  const staticResearch = {
    overview: report.overview,
    cs_ai_department: report.cs_ai_department,
    student_experience: report.student_experience,
    honest_assessment: report.honest_assessment,
  }
  const dynamicResearch = {
    admission: report.admission,
    financials: report.financials,
  }
  return mode === 'refresh'
    ? { dynamic_research: dynamicResearch, dynamic_refreshed_at: now }
    : {
        static_research: staticResearch,
        dynamic_research: dynamicResearch,
        static_researched_at: now,
        dynamic_refreshed_at: now,
      }
}

const LLMService = {
  async generateGroundedContent(prompt) {
    return this.generateContent(prompt, true)
  },

  async generateContent(prompt, useGrounding = false) {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      ...(useGrounding ? { tools: [{ googleSearch: {} }] } : {}),
    })

    return extractGeminiTextAndCitations(result.response)
  },
}

function extractGeminiTextAndCitations(response) {
  const textParts = []
  const citations = []

  try {
    const text = response.text()
    if (text) textParts.push(text)
  } catch (_) {
    for (const candidate of response.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.text) textParts.push(part.text)
      }
    }
  }

  for (const candidate of response.candidates ?? []) {
    const metadata = candidate.groundingMetadata ?? {}
    for (const chunk of metadata.groundingChunks ?? []) {
      const web = chunk.web
      if (web?.uri) {
        citations.push({
          url: web.uri,
          title: web.title ?? web.uri,
          sourceType: inferSourceType(`${web.uri} ${web.title ?? ''}`),
        })
      }
    }
    for (const query of metadata.webSearchQueries ?? []) {
      citations.push({ url: googleSearchUrl(query), title: query, sourceType: 'web' })
    }
  }

  return { text: textParts.join('\n'), citations: dedupeCitations(citations) }
}

function googleSearchUrl(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

function buildSources(entityType, entityId, searchResults) {
  const sources = []
  for (const result of searchResults) {
    if (!result.citations?.length) {
      sources.push({
        entity_type: entityType,
        entity_id: entityId,
        citation_index: result.citationIndex,
        source_url: `search:${result.title}`,
        source_title: result.title,
        source_type: inferSourceType(result.title),
      })
      continue
    }
    for (const citation of result.citations) {
      sources.push({
        entity_type: entityType,
        entity_id: entityId,
        citation_index: citation.citationIndex,
        source_url: citation.url,
        source_title: citation.title,
        source_type: citation.sourceType ?? inferSourceType(`${citation.url} ${citation.title}`),
      })
    }
  }
  return sources
}

function inferSourceType(text) {
  const value = text.toLowerCase()
  if (value.includes('reddit.com')) return 'reddit'
  if (value.includes('quora.com')) return 'quora'
  if (value.includes('ranking') || value.includes('qs') || value.includes('timeshighereducation')) return 'ranking'
  if (value.includes('.edu') || value.includes('.ac.') || value.includes('.go.') || value.includes('gov')) return 'official'
  if (value.includes('news')) return 'news'
  return 'web'
}

function buildCountryResearchPrompts(country, mode) {
  const prompts = []
  if (mode === 'initial') {
    prompts.push({
      key: 'country_static',
      title: `${country.name} static student, culture, PR, and Indian community research`,
      label: 'Student, PR, and community data collected',
      prompt: `Research ${country.name} for an Indian CS/AI Masters student planning long-term settlement.

Use Google Search grounding to find specific, current, source-backed information about:
- student experience for international and Indian students
- cultural reception of Indians/foreigners, safety, social life, and language barriers
- permanent residency pathway overview for Indian skilled workers or international graduates
- Indian community size, support networks, and settlement experience

Return concise notes grouped under those headings. Include concrete source-backed facts and mention contradictions or uncertainty.`,
    })
  }

  prompts.push({
    key: 'country_dynamic',
    title: `${country.name} current PR, cost, AI/ML jobs, and policy research`,
    label: 'Current PR, cost, policy, and job-market data collected',
    prompt: `Research current 2025/2026 information for ${country.name} for an Indian CS/AI Masters student.

Use Google Search grounding to find specific, current, source-backed information about:
- PR or skilled migration processing times and eligibility changes
- cost of living for students in USD, including rent, groceries, transport, and monthly budget
- AI/ML and software engineering job market, salary ranges, and notable employers
- recent international student, work permit, post-study work, or immigration policy changes

Prioritize official government/university pages, recent cost guides, salary/job-market sources, and reputable news.`,
  })

  if (mode === 'initial') {
    prompts.push({
      key: 'country_community_sentiment',
      title: `${country.name} Reddit and Quora Indian student sentiment research`,
      label: 'Reddit and Quora community sentiment collected',
      prompt: `Search Reddit and Quora specifically for honest opinions from Indian students, Indian expats, and international graduates about ${country.name}.

Look for recurring positives, recurring negatives, settlement concerns, racism/discrimination concerns, job-search reality, PR frustration, and quality-of-life tradeoffs.

Return a balanced sentiment summary. Include short representative paraphrases rather than long quotes, and identify whether the source is Reddit or Quora where possible.`,
    })
  }

  return prompts
}

function buildUniversityResearchPrompts(university, country, mode) {
  const location = `${university.name}, ${university.city ?? country.name}, ${country.name}`
  const prompts = []
  if (mode === 'initial') {
    prompts.push({
      key: 'university_static',
      title: `${location} static university, CS/AI department, ranking, and outcomes research`,
      label: 'University overview and CS/AI department data collected',
      prompt: `Research ${location} for an Indian CS/AI Masters applicant.

Use Google Search grounding to find specific, source-backed information about:
- university overview: location, founded year, campus, university type, and rankings
- CS/computer science/AI department reputation and CS-specific rankings
- AI/ML faculty, research areas, labs, and industry connections
- alumni outcomes or career outcomes relevant to AI/ML and software roles

Prioritize official university pages, ranking pages, department pages, and credible career outcome sources.`,
    })
  }

  prompts.push({
    key: 'university_dynamic',
    title: `${location} current admissions, tuition, scholarships, and intake research`,
    label: 'Current admission and financial data collected',
    prompt: `Research current 2025/2026 and Fall 2027 admissions information for ${location}.

Use Google Search grounding to find specific, source-backed information about:
- relevant Masters program names for CS, data science, AI, or machine learning
- duration, GPA, English test, GRE, work-experience, and prerequisite requirements
- Fall 2027 application deadlines if available, otherwise the latest published deadline cycle
- international tuition, total estimated program cost, scholarships, TA/RA funding, and financial aid
- intake size or acceptance-rate estimates if credible sources exist

Prioritize official admissions, tuition, scholarship, and department pages. Mark unavailable data clearly.`,
  })

  if (mode === 'initial') {
    prompts.push({
      key: 'university_community_sentiment',
      title: `${location} Reddit and Quora student sentiment research`,
      label: 'Reddit and Quora university sentiment collected',
      prompt: `Search Reddit and Quora specifically for honest opinions from Indian students, international students, CS Masters students, and expats about ${location}.

Look for recurring positives, recurring negatives, campus life, housing, Indian community, CS/AI course quality, professor access, job outcomes, internship reality, and city fit.

Return a balanced sentiment summary. Include short representative paraphrases rather than long quotes, and identify whether the source is Reddit or Quora where possible.`,
    })
  }

  return prompts
}

function assignCitationIndexes(results) {
  let citationIndex = 1
  for (const result of results) {
    if (!result.citations?.length) {
      result.citationIndex = citationIndex
      citationIndex += 1
      continue
    }
    for (const citation of result.citations) {
      citation.citationIndex = citationIndex
      citationIndex += 1
    }
    result.citationIndex = result.citations[0].citationIndex
  }
}

function getCitationIndexesFromJson(value) {
  const indexes = new Set()
  const text = JSON.stringify(value ?? {})
  for (const match of text.matchAll(/\[(\d+)\]/g)) {
    indexes.add(Number(match[1]))
  }
  return indexes
}

function shiftCitationReferences(value, offset) {
  if (!offset || value === null || value === undefined) return value
  if (typeof value === 'string') {
    return value.replace(/\[(\d+)\]/g, (_, number) => `[${Number(number) + offset}]`)
  }
  if (Array.isArray(value)) return value.map(item => shiftCitationReferences(item, offset))
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, shiftCitationReferences(item, offset)]),
    )
  }
  return value
}

function shiftSearchResultCitations(results, offset) {
  if (!offset) return results
  return results.map(result => ({
    ...result,
    citationIndex: result.citationIndex + offset,
    text: shiftCitationReferences(result.text, offset),
    citations: (result.citations ?? []).map(citation => ({
      ...citation,
      citationIndex: citation.citationIndex + offset,
    })),
  }))
}

function buildCountrySynthesisPrompt(country, results) {
  return `${countrySystemPrompt()}

Country: ${country.name}

Search results:
${formatSearchResults(results)}

Return only strict JSON matching the requested schema.`
}

function countrySystemPrompt() {
  return `You are a research assistant helping an Indian CS student (final year, AI/ML specialization) evaluate countries for Masters study and long-term settlement. Synthesize the provided search results into a structured JSON report. Be factual, cite sources by index number [1], [2] etc, and be honest about negatives - do not only present positives. This student wants to settle permanently, so PR pathway and quality of life for a working professional matter as much as the university itself. Do not hallucinate. If a piece of information is not in the search results, say "No data found" for that field rather than guessing.

Output schema:
{
  "student_experience": {"indian_community": "", "cultural_adjustment": "", "language_barrier": "", "safety": "", "social_life": ""},
  "pr_pathway": {"route_name": "", "typical_timeline_years": "", "success_rate_for_indians": "", "key_requirements": [], "recent_policy_changes": "", "honest_assessment": ""},
  "cost_of_living": {"monthly_student_budget_usd": "", "rent_range_usd": "", "groceries_monthly_usd": "", "transport_monthly_usd": "", "source_year": "2025/2026"},
  "job_market": {"ai_ml_demand": "", "average_salary_usd": "", "top_employers": [], "job_market_honest_assessment": ""},
  "reddit_community_sentiment": {"summary": "", "common_positives": [], "common_negatives": [], "representative_quotes": []},
  "overall_settlement_verdict": ""
}`
}

function buildUniversitySynthesisPrompt(university, country, results) {
  return `${universitySystemPrompt()}

University: ${university.name}
Country: ${country.name}
City: ${university.city ?? 'No data found'}

Search results:
${formatSearchResults(results)}

Return only strict JSON matching the requested schema.`
}

function universitySystemPrompt() {
  return `You are a research assistant helping an Indian CS student with AI/ML specialization evaluate Masters programs. Synthesize the provided search results into a structured JSON report. Be factual, cite sources by index number [1], [2] etc, and be honest about negatives. Do not hallucinate. If information is not in the search results, say "No data found".

Output schema:
{
  "overview": {"founded": "", "location": "", "overall_qs_ranking": "", "cs_specific_ranking": "", "university_type": "", "campus_size": ""},
  "cs_ai_department": {"department_reputation": "", "ai_ml_faculty_highlights": [], "research_areas": [], "industry_connections": "", "reddit_consensus": ""},
  "admission": {"program_name": "", "duration_years": "", "intake": "", "gpa_requirement": "", "english_requirement": "", "gre_required": "", "work_experience_expected": "", "application_deadline_fall2027": "", "acceptance_rate_estimate": "", "intake_size_estimate": ""},
  "financials": {"annual_tuition_usd": "", "total_program_cost_usd": "", "scholarships_available": "", "scholarship_names": [], "ta_ra_opportunities": ""},
  "student_experience": {"indian_community_size": "", "campus_life": "", "housing_options": "", "reddit_honest_review": ""},
  "honest_assessment": {"strengths": [], "weaknesses": [], "fit_for_ai_ml_career": "", "overall_verdict": ""}
}`
}

function formatSearchResults(results) {
  return results
    .map(result => {
      const sources = result.citations?.length
        ? result.citations
            .map(citation => `[${citation.citationIndex}] ${citation.title} - ${citation.url}`)
            .join('\n')
        : `[${result.citationIndex}] ${result.title}`
      return `${result.title}\nSources:\n${sources}\nFindings:\n${result.text}`
    })
    .join('\n\n')
}

function extractJson(text) {
  const clean = text.replace(/```json|```/g, '').trim()
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in synthesis')
  return JSON.parse(clean.slice(start, end + 1))
}

function dedupeCitations(citations) {
  const seen = new Set()
  return citations.filter(citation => {
    if (seen.has(citation.url)) return false
    seen.add(citation.url)
    return true
  })
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}
